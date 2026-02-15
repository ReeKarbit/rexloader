// Vercel Serverless Function - Media Download API
// Replaces api.php for Vercel deployment
// Handles Twitter/X and fallback for other platforms

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', text: 'Method not allowed' });
    }

    try {
        const { url, downloadMode = 'auto', videoQuality = '720' } = req.body;

        if (!url) {
            return res.status(400).json({ status: 'error', text: 'URL required' });
        }

        // Detect platform
        const platform = detectPlatform(url);

        // Try Cobalt API (supports Twitter, TikTok, YouTube, etc.)
        const result = await tryCobaltAPI(url, downloadMode, videoQuality, platform);

        if (result && result.status !== 'error') {
            return res.json(result);
        }

        // If Cobalt fails, try TikTok-specific providers
        if (platform === 'tiktok') {
            const tikTokResult = await tryTikTokProviders(url);
            if (tikTokResult && tikTokResult.status !== 'error') {
                return res.json(tikTokResult);
            }
        }

        return res.json({
            status: 'error',
            text: 'Unable to process this link. Please try again later.'
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            status: 'error',
            text: 'Server error: ' + error.message
        });
    }
}

// Detect platform from URL
function detectPlatform(url) {
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook';
    if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
    return 'unknown';
}

// Try Cobalt API (supports multiple platforms including Twitter)
async function tryCobaltAPI(url, downloadMode, videoQuality, platform) {
    try {
        const response = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                vCodec: 'h264',
                vQuality: videoQuality,
                aFormat: 'mp3',
                isAudioOnly: downloadMode === 'audio'
            })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data.status === 'error' || data.status === 'rate-limit') {
            return null;
        }

        // Parse Cobalt response
        const variants = [];

        if (data.url) {
            // Single download URL
            variants.push({
                type: downloadMode === 'audio' ? 'audio' : 'video-hd',
                name: downloadMode === 'audio' ? 'MP3 AUDIO' : 'HD VIDEO',
                url: data.url,
                quality: videoQuality || 'hd',
                size: 'UNKNOWN'
            });
        }

        if (data.picker && Array.isArray(data.picker)) {
            // Multiple variants
            data.picker.forEach((item, index) => {
                variants.push({
                    type: item.type === 'photo' ? 'image' : 'video-hd',
                    name: `${item.type?.toUpperCase() || 'MEDIA'} ${index + 1}`,
                    url: item.url,
                    quality: 'hd',
                    size: 'UNKNOWN'
                });
            });
        }

        if (variants.length === 0) {
            return null;
        }

        return {
            status: 'success',
            url: variants[0].url,
            title: `${platform}_download`,
            platform: platform,
            variants: variants
        };

    } catch (error) {
        console.error('Cobalt API error:', error);
        return null;
    }
}

// Try TikTok-specific providers as fallback
async function tryTikTokProviders(url) {
    // Try TikWM API
    try {
        const response = await fetch('https://www.tikwm.com/api/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                url: url,
                hd: '1'
            })
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data.code !== 0 || !data.data) {
            return null;
        }

        const variants = [];

        // Add video variant
        if (data.data.play) {
            variants.push({
                type: 'video-hd',
                name: 'HD NO WATERMARK',
                url: data.data.play,
                quality: 'hd',
                size: 'UNKNOWN'
            });
        }

        // Add music variant
        if (data.data.music) {
            variants.push({
                type: 'audio',
                name: 'MP3 AUDIO',
                url: data.data.music,
                quality: 'audio',
                size: 'UNKNOWN'
            });
        }

        if (variants.length === 0) {
            return null;
        }

        return {
            status: 'success',
            url: variants[0].url,
            title: data.data.title || 'tiktok_video',
            platform: 'tiktok',
            variants: variants
        };

    } catch (error) {
        console.error('TikWM API error:', error);
        return null;
    }
}
