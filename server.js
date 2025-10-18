const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = 3000;

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const thumbnailsDir = path.join(__dirname, 'thumbnails');
const tempDir = path.join(__dirname, 'temp');

[uploadsDir, thumbnailsDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv', 'video/m4v'
        ];
        
        if (allowedTypes.includes(file.mimetype) || 
            file.originalname.toLowerCase().endsWith('.heic') || 
            file.originalname.toLowerCase().endsWith('.heif')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Helper function to convert HEIC to JPEG
async function convertHeicToJpeg(inputPath, outputPath) {
    try {
        const inputBuffer = fs.readFileSync(inputPath);
        const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 0.8
        });
        fs.writeFileSync(outputPath, outputBuffer);
        return true;
    } catch (error) {
        console.error('HEIC conversion error:', error);
        return false;
    }
}

// Helper function to create image thumbnail
async function createImageThumbnail(inputPath, outputPath, isHeic = false) {
    try {
        if (isHeic) {
            const tempJpegPath = path.join(tempDir, `temp_${Date.now()}.jpg`);
            const converted = await convertHeicToJpeg(inputPath, tempJpegPath);
            if (!converted) return false;
            
            await sharp(tempJpegPath)
                .resize(300, 300, { fit: 'cover' })
                .jpeg({ quality: 60, progressive: true })
                .toFile(outputPath);
                
            fs.unlinkSync(tempJpegPath); // Clean up temp file
        } else {
            await sharp(inputPath)
                .resize(300, 300, { fit: 'cover' })
                .jpeg({ quality: 60, progressive: true })
                .toFile(outputPath);
        }
        return true;
    } catch (error) {
        console.error('Thumbnail creation error:', error);
        return false;
    }
}

// Helper function to create video thumbnail
async function createVideoThumbnail(inputPath, outputPath) {
    return new Promise((resolve) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '300x300'
            })
            .on('end', () => resolve(true))
            .on('error', (err) => {
                console.error('Video thumbnail error:', err);
                resolve(false);
            });
    });
}

// Helper function to get file type
function getFileType(filename, mimetype) {
    const ext = path.extname(filename).toLowerCase();
    const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
    const heicExts = ['.heic', '.heif'];
    
    if (videoExts.includes(ext) || mimetype.startsWith('video/')) {
        return 'video';
    } else if (heicExts.includes(ext) || mimetype === 'image/heic' || mimetype === 'image/heif') {
        return 'heic';
    } else {
        return 'image';
    }
}

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/thumbnails', express.static('thumbnails'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all media files with pagination
app.get('/api/images', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const files = fs.readdirSync(uploadsDir);
        const allMediaFiles = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return /\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i.test(ext);
            })
            .map(file => {
                const nameWithoutExt = path.parse(file).name;
                const thumbnailPath = path.join(thumbnailsDir, `${nameWithoutExt}.jpg`);
                const fileType = getFileType(file, '');
                const stats = fs.statSync(path.join(uploadsDir, file));
                
                return {
                    filename: file,
                    url: `/uploads/${file}`,
                    thumbnailUrl: fs.existsSync(thumbnailPath) ? `/thumbnails/${nameWithoutExt}.jpg` : null,
                    type: fileType,
                    uploadTime: stats.mtime,
                    size: stats.size
                };
            })
            .sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
        
        const totalFiles = allMediaFiles.length;
        const mediaFiles = allMediaFiles.slice(offset, offset + limit);
        
        res.json({
            files: mediaFiles,
            pagination: {
                page,
                limit,
                total: totalFiles,
                totalPages: Math.ceil(totalFiles / limit),
                hasMore: offset + limit < totalFiles
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read media files' });
    }
});

// Upload media file
app.post('/api/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const filename = req.file.filename;
    const nameWithoutExt = path.parse(filename).name;
    const thumbnailPath = path.join(thumbnailsDir, `${nameWithoutExt}.jpg`);
    const fileType = getFileType(filename, req.file.mimetype);
    
    try {
        let thumbnailCreated = false;
        
        if (fileType === 'video') {
            thumbnailCreated = await createVideoThumbnail(filePath, thumbnailPath);
        } else if (fileType === 'heic') {
            thumbnailCreated = await createImageThumbnail(filePath, thumbnailPath, true);
        } else {
            thumbnailCreated = await createImageThumbnail(filePath, thumbnailPath, false);
        }
        
        res.json({
            filename: filename,
            url: `/uploads/${filename}`,
            thumbnailUrl: thumbnailCreated ? `/thumbnails/${nameWithoutExt}.jpg` : `/uploads/${filename}`,
            type: fileType
        });
    } catch (error) {
        console.error('Upload processing error:', error);
        res.json({
            filename: filename,
            url: `/uploads/${filename}`,
            thumbnailUrl: `/uploads/${filename}`,
            type: fileType
        });
    }
});

// Delete media file
app.delete('/api/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    const nameWithoutExt = path.parse(filename).name;
    const thumbnailPath = path.join(thumbnailsDir, `${nameWithoutExt}.jpg`);
    
    try {
        let deleted = false;
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deleted = true;
        }
        
        // Also delete thumbnail if it exists
        if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
        }
        
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.listen(PORT, () => {
    console.log(`Instagram Grid Preview running at http://localhost:${PORT}`);
});