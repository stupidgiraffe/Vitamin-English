const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3 client for Cloudflare R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vitamin-english-pdfs';

/**
 * Upload a PDF buffer to Cloudflare R2
 * @param {Buffer} pdfBuffer - PDF file as buffer
 * @param {String} fileName - Name for the file in R2
 * @param {Object} metadata - Optional metadata for the file
 * @returns {Promise<Object>} Upload result with key and URL
 */
async function uploadPDF(pdfBuffer, fileName, metadata = {}) {
    try {
        // Generate a unique key with timestamp
        const timestamp = Date.now(); // Use Unix timestamp for better sorting
        const key = `pdfs/${timestamp}_${fileName}`;
        
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
            Metadata: {
                uploadedAt: new Date().toISOString(),
                ...metadata
            }
        });
        
        await r2Client.send(command);
        
        // Return key only, not a public URL (use signed URLs for security)
        return {
            success: true,
            key: key,
            url: '', // Placeholder - use getDownloadUrl() for actual access
            fileName: fileName,
            size: pdfBuffer.length
        };
    } catch (error) {
        console.error('Error uploading PDF to R2:', error);
        throw new Error(`Failed to upload PDF: ${error.message}`);
    }
}

/**
 * Generate a signed URL for downloading a PDF from R2
 * @param {String} key - The file key in R2
 * @param {Number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<String>} Signed download URL
 */
async function getDownloadUrl(key, expiresIn = 3600) {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        
        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
        
        return signedUrl;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw new Error(`Failed to generate download URL: ${error.message}`);
    }
}

/**
 * Delete a PDF from R2
 * @param {String} key - The file key in R2
 * @returns {Promise<Object>} Deletion result
 */
async function deletePDF(key) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        
        await r2Client.send(command);
        
        return {
            success: true,
            message: `File ${key} deleted successfully`
        };
    } catch (error) {
        console.error('Error deleting PDF from R2:', error);
        throw new Error(`Failed to delete PDF: ${error.message}`);
    }
}

/**
 * List all PDFs in R2 bucket
 * @param {String} prefix - Optional prefix to filter files (default: 'pdfs/')
 * @param {Number} maxKeys - Maximum number of files to return (default: 100)
 * @returns {Promise<Array>} List of files
 */
async function listPDFs(prefix = 'pdfs/', maxKeys = 100) {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            MaxKeys: maxKeys
        });
        
        const response = await r2Client.send(command);
        
        const files = (response.Contents || []).map(file => ({
            key: file.Key,
            size: file.Size,
            lastModified: file.LastModified,
            fileName: file.Key.split('/').pop()
        }));
        
        return files;
    } catch (error) {
        console.error('Error listing PDFs from R2:', error);
        throw new Error(`Failed to list PDFs: ${error.message}`);
    }
}

/**
 * Check if R2 is properly configured
 * @returns {Boolean} True if configured, false otherwise
 */
function isConfigured() {
    return !!(
        process.env.R2_ENDPOINT &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME
    );
}

module.exports = {
    uploadPDF,
    getDownloadUrl,
    deletePDF,
    listPDFs,
    isConfigured,
    r2Client
};
