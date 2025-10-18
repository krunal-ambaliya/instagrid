# Instagram Grid Preview

A simple web application to preview how your images will look in an Instagram grid layout. Upload images and see them arranged in a 3x3 grid just like Instagram's profile view.

## Features

- 📸 Drag & drop or click to upload images
- 📱 Instagram-style 3x3 grid preview
- 👁️ Full-size image viewing
- 🗑️ Delete images with hover controls
- 💾 Images stored locally in the uploads folder
- 🚀 Single command to run

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and go to: `http://localhost:3000`

## How to Use

1. **Upload Images**: Drag and drop images onto the upload area or click to browse files
2. **Preview Grid**: See how your images will look in Instagram's 3x3 grid layout
3. **View Full Size**: Click on any image to see it in full size
4. **Delete Images**: Hover over images and click the delete button to remove them

## File Structure

```
├── server.js          # Express server
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Main HTML file
│   ├── style.css      # Styling
│   └── script.js      # Frontend JavaScript
├── uploads/           # Uploaded images (created automatically)
└── README.md          # This file
```

## Tech Stack

- **Backend**: Node.js + Express
- **File Upload**: Multer
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Storage**: Local file system

No external database required - all images are stored in the local `uploads` directory.