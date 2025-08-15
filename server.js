// server.js
require('dotenv').config(); // Tải biến môi trường từ .env ngay từ đầu

const express = require('express');
const AWS = require('aws-sdk'); // Sử dụng AWS SDK vì CloudFly tương thích S3 API
const cors = require('cors'); // Middleware để xử lý Cross-Origin Resource Sharing
const path = require('path'); // Để phục vụ các file tĩnh (HTML, JS)

const app = express();
const port = process.env.PORT || 3000; // Sử dụng cổng từ biến môi trường hoặc mặc định 3000

// Cấu hình AWS SDK để trỏ đến CloudFly Object Storage
AWS.config.update({
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
    s3ForcePathStyle: true, // Rất quan trọng cho các dịch vụ S3 tương thích
    signatureVersion: 'v4', // Phiên bản chữ ký cho các yêu cầu
    region: 'us-east-1' // Region placeholder, CloudFly có thể không dùng nhưng SDK cần
});

const s3 = new AWS.S3();
const OBJECT_STORAGE_BUCKET_NAME = process.env.OBJECT_STORAGE_BUCKET_NAME;

// --- Middlewares ---
app.use(cors()); // Cho phép các yêu cầu từ các nguồn khác (ví dụ: frontend chạy ở cổng khác)
app.use(express.json()); // Để phân tích body của request dưới dạng JSON

// Phục vụ các file tĩnh từ thư mục 'public'
// Khi bạn truy cập http://localhost:3000/, nó sẽ hiển thị public/index.html
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoint để lấy Pre-signed URL tải lên ---
app.post('/api/get-presigned-url', async (req, res) => {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
        return res.status(400).json({ message: 'Missing fileName or fileType in request body.' });
    }

    const params = {
        Bucket: OBJECT_STORAGE_BUCKET_NAME,
        Key: fileName, // Tên tệp trong Object Storage
        ContentType: fileType,
        Expires: 60 * 5 // URL có hiệu lực trong 5 phút
    };

    try {
        // Tạo Pre-signed URL cho thao tác 'putObject' (tải lên)
        const url = await s3.getSignedUrlPromise('putObject', params);
        res.json({ url });
    } catch (error) {
        console.error('Error getting Pre-signed URL for upload:', error);
        res.status(500).json({ message: 'Could not create Pre-signed URL for upload.', error: error.message });
    }
});

// --- API Endpoint để lấy danh sách tệp ---
app.get('/api/list-files', async (req, res) => {
    const params = {
        Bucket: OBJECT_STORAGE_BUCKET_NAME
    };

    try {
        const data = await s3.listObjectsV2(params).promise();
        const files = data.Contents.map(item => {
            // Tạo Pre-signed URL để tải xuống cho mỗi tệp
            // Đây là cách an toàn nhất nếu các tệp không công khai
            const downloadUrl = s3.getSignedUrl('getObject', {
                Bucket: OBJECT_STORAGE_BUCKET_NAME,
                Key: item.Key,
                Expires: 60 * 5 // URL có hiệu lực trong 5 phút
            });

            return {
                name: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                downloadUrl: downloadUrl // Trả về URL tải xuống cho frontend
            };
        });
        res.json(files);
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ message: 'Could not list files from Object Storage.', error: error.message });
    }
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Connecting to Object Storage at: ${process.env.OBJECT_STORAGE_ENDPOINT}`);
    console.log(`Using bucket: ${OBJECT_STORAGE_BUCKET_NAME}`);
});
