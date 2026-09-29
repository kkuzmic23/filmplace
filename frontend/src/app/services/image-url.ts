import { PUBLIC_API_URL } from '../app.config';

//returns url of external and own images
export const imageUrl = (imagePath: string, width = 1200): string => {
  //external image
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  //http:localhost:8080/images/sx-70-1.jpeg?w=480
  return `${PUBLIC_API_URL.replace('/api', '')}${imagePath}?w=${width}`;
};

//for own images returns 2 links with w=480 and w=1200
export const imageSrcset = (imagePath: string): string | null => {
  if (imagePath.startsWith('http')) {
    return null;
  }

  return [480, 1200].map((width) => `${imageUrl(imagePath, width)} ${width}w`).join(', ');
};
