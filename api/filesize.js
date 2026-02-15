// Vercel Serverless Function - File Size Detection
// Replaces filesize.php for Vercel deployment

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }

        // Perform HEAD request to get file size
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            }
        });

        if (!response.ok) {
            return res.json({ size: 'UNKNOWN' });
        }

        const contentLength = response.headers.get('content-length');

        if (!contentLength) {
            return res.json({ size: 'UNKNOWN' });
        }

        const bytes = parseInt(contentLength, 10);
        const formatted = formatBytes(bytes);

        return res.json({ size: formatted, bytes: bytes });

    } catch (error) {
        console.error('File size detection error:', error);
        return res.json({ size: 'UNKNOWN' });
    }
}

// Format bytes to human-readable size
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
