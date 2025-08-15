// app.js

// Lấy các phần tử HTML cần thiết
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');
const uploadStatus = document.getElementById('uploadStatus');
const refreshListButton = document.getElementById('refreshListButton');
const fileList = document.getElementById('fileList');
const listStatus = document.getElementById('listStatus');

// 💡 Quan trọng: Đặt URL của backend server của bạn tại đây.
// Nếu backend chạy trên máy tính của bạn, thường là http://localhost:3000
const BACKEND_URL = 'http://localhost:3000';

// --- Chức năng Tải Lên Tệp ---
uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0]; // Lấy tệp đầu tiên mà người dùng đã chọn

    if (!file) {
        uploadStatus.textContent = 'Vui lòng chọn một tệp để tải lên.';
        uploadStatus.className = 'message error';
        return;
    }

    uploadStatus.textContent = 'Đang yêu cầu URL tải lên từ máy chủ...';
    uploadStatus.className = 'message info';

    try {
        // Bước 1: Yêu cầu backend server cấp Pre-signed URL để tải lên
        // Backend sẽ tạo một URL có chữ ký, cho phép trình duyệt tải lên trực tiếp S3
        const response = await fetch(`${BACKEND_URL}/api/get-presigned-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileName: file.name, fileType: file.type }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Không thể lấy URL tải lên.');
        }

        const { url } = await response.json(); // Nhận Pre-signed URL từ backend

        uploadStatus.textContent = `Đang tải lên "${file.name}" trực tiếp đến Object Storage...`;
        uploadStatus.className = 'message info';

        // Bước 2: Tải tệp trực tiếp lên Object Storage bằng Pre-signed URL
        const uploadResponse = await fetch(url, {
            method: 'PUT', // Thường là PUT cho việc tải lên tệp
            headers: {
                'Content-Type': file.type, // Đặt Content-Type của tệp để Object Storage nhận diện đúng
            },
            body: file, // Gửi chính đối tượng tệp làm body của yêu cầu
        });

        if (!uploadResponse.ok) {
            // S3/CloudFly thường trả về lỗi trực tiếp qua status code
            throw new Error(`Tải lên Object Storage thất bại: ${uploadResponse.statusText}`);
        }

        uploadStatus.textContent = `✅ Tải lên "${file.name}" thành công!`;
        uploadStatus.className = 'message success';
        fileInput.value = ''; // Xóa tệp đã chọn khỏi input
        listFiles(); // Làm mới danh sách tệp sau khi tải lên thành công
    } catch (error) {
        console.error('Lỗi tải lên:', error);
        uploadStatus.textContent = `❌ Lỗi tải lên: ${error.message}`;
        uploadStatus.className = 'message error';
    }
});

// --- Chức năng Hiển thị Danh sách Tệp ---
refreshListButton.addEventListener('click', listFiles);

async function listFiles() {
    listStatus.textContent = 'Đang tải danh sách tệp từ máy chủ...';
    listStatus.className = 'message info';
    fileList.innerHTML = ''; // Xóa danh sách cũ để cập nhật

    try {
        // Yêu cầu backend server lấy danh sách tệp
        const response = await fetch(`${BACKEND_URL}/api/list-files`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Không thể lấy danh sách tệp.');
        }

        const files = await response.json(); // Nhận danh sách tệp từ backend

        if (files.length === 0) {
            fileList.innerHTML = '<li>Chưa có tệp nào được tải lên.</li>';
            listStatus.textContent = 'Danh sách hiện đang trống.';
            listStatus.className = 'message info';
            return;
        }

        // Duyệt qua danh sách tệp và thêm vào HTML
        files.forEach(file => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="file-name">${file.name}</span>
                <a href="${file.downloadUrl}" target="_blank" class="download-link">Tải xuống ⬇️</a>
            `;
            // Lưu ý: file.downloadUrl phải được backend cung cấp.
            // Nếu backend không cung cấp, bạn cần điều chỉnh logic ở đây.
            fileList.appendChild(li);
        });
        listStatus.textContent = `📋 Đã tải ${files.length} tệp thành công.`;
        listStatus.className = 'message success';
    } catch (error) {
        console.error('Lỗi khi lấy danh sách tệp:', error);
        listStatus.textContent = `❌ Lỗi khi lấy danh sách tệp: ${error.message}`;
        listStatus.className = 'message error';
    }
}

// Tải danh sách tệp khi trang được tải lần đầu
document.addEventListener('DOMContentLoaded', listFiles);
