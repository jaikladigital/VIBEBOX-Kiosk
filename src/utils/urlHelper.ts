export const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  return /\.(apng|png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(url);
};

export const processGoogleDriveUrl = (url: string): string => {
  if (!url) return url;

  // Clean up any previously added corsproxy
  if (url.includes("corsproxy.io")) {
    try {
      const decoded = decodeURIComponent(url.split("?")[1] || "");
      if (
        decoded.includes("drive.google.com") ||
        decoded.includes("lh3.googleusercontent.com")
      ) {
        url = decoded;
      }
    } catch (e) {
      // Ignore
    }
  }

  // Extract ID if it's a direct Google Drive id link
  const gdriveMatch = url.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  );
  if (gdriveMatch && gdriveMatch[1]) {
    // lh3 is incredibly reliable for fetching pure picture/gif/svg content from drive
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }

  // Extract ID if it's already a UC or thumbnail link
  const existingIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (
    existingIdMatch &&
    existingIdMatch[1] &&
    (url.includes("uc?export") ||
      url.includes("thumbnail?id") ||
      url.includes("uc?id="))
  ) {
    return `https://lh3.googleusercontent.com/d/${existingIdMatch[1]}`;
  }

  return url;
};

export const getYoutubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/,
  );
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

export const getGoogleDriveVideoUrl = (url: string): string | null => {
  if (!url) return null;

  // If the user already provided an lh3 link, return it directly
  if (url.includes("lh3.googleusercontent.com")) {
    return url;
  }

  // Standard Google Drive file URL regex matching
  const match =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com.*[?&]id=([a-zA-Z0-9_-]+)/);

  if (match && match[1]) {
    // Return a direct download stream route using Google's directusercontent
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }

  // Default to returning original URL if we can't parse it as Google Drive, instead of null, so normal URLs work too!
  return url;
};
