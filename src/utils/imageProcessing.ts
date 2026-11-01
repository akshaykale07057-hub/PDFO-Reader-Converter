export interface Point2D {
  x: number;
  y: number;
}

export interface DocumentBounds {
  topLeft: Point2D;
  topRight: Point2D;
  bottomLeft: Point2D;
  bottomRight: Point2D;
  confidence: number;
}

function getOtsuThreshold(grayData: Uint8Array): number {
  const histogram = new Int32Array(256);
  for (let i = 0; i < grayData.length; i++) {
    histogram[grayData[i]]++;
  }
  
  const total = grayData.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }
  
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 0;
  
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  
  return threshold;
}

function findLargestComponent(binaryData: boolean[], width: number, height: number): Point2D[] {
  const visited = new Uint8Array(width * height);
  let largestComponent: Point2D[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryData[idx] && !visited[idx]) {
        const component: Point2D[] = [];
        const queue: number[] = [idx];
        visited[idx] = 1;
        
        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          const cy = Math.floor(curr / width);
          const cx = curr % width;
          component.push({ x: cx, y: cy });
          
          const neighbors = [
            curr - 1,
            curr + 1,
            curr - width,
            curr + width
          ];
          
          for (let i = 0; i < neighbors.length; i++) {
            const n = neighbors[i];
            const ny = Math.floor(n / width);
            const nx = n % width;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (i === 0 && nx === width - 1) continue;
              if (i === 1 && nx === 0) continue;
              
              if (binaryData[n] && !visited[n]) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }
        }
        
        if (component.length > largestComponent.length) {
          largestComponent = component;
        }
      }
    }
  }
  return largestComponent;
}

export const detectCornersFromSource = (
  source: HTMLVideoElement | HTMLCanvasElement,
  tempCanvas: HTMLCanvasElement = document.createElement('canvas')
): DocumentBounds | null => {
  try {
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    const w = 200;
    const h = 150;
    tempCanvas.width = w;
    tempCanvas.height = h;

    let sourceWidth = 0;
    if (source instanceof HTMLVideoElement) {
      sourceWidth = source.videoWidth;
    } else {
      sourceWidth = source.width;
    }
    if (sourceWidth === 0) return null;

    ctx.drawImage(source, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 1. Grayscale conversion
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
    }

    // 2. Box Blur
    const blurred = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += gray[(y + ky) * w + (x + kx)];
          }
        }
        blurred[y * w + x] = Math.round(sum / 9);
      }
    }

    // 3. Otsu's thresholding
    const threshold = getOtsuThreshold(blurred);

    // 4. Binarization for both Light and Dark document possibilities
    const optionLight = new Array(w * h);
    const optionDark = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
      optionLight[i] = blurred[i] > threshold;
      optionDark[i] = blurred[i] <= threshold;
    }

    // Exclude outer 5% margin to prevent background shadows or borders from skewing corners
    const marginW = Math.floor(w * 0.05);
    const marginH = Math.floor(h * 0.05);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < marginW || x >= w - marginW || y < marginH || y >= h - marginH) {
          const idx = y * w + x;
          optionLight[idx] = false;
          optionDark[idx] = false;
        }
      }
    }

    const compLight = findLargestComponent(optionLight, w, h);
    const compDark = findLargestComponent(optionDark, w, h);

    const minAreaPixels = w * h * 0.15;
    let bestComp = compLight;
    if (compDark.length > compLight.length) {
      bestComp = compDark;
    }

    if (bestComp.length < minAreaPixels) {
      return null;
    }

    // Find extreme points
    let tl = bestComp[0];
    let tr = bestComp[0];
    let bl = bestComp[0];
    let br = bestComp[0];

    let minSum = w + h;
    let maxSum = 0;
    let minDiff = w + h;
    let maxDiff = -w - h;

    for (const p of bestComp) {
      const sum = p.x + p.y;
      const diff = p.x - p.y;

      if (sum < minSum) {
        minSum = sum;
        tl = p;
      }
      if (sum > maxSum) {
        maxSum = sum;
        br = p;
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        tr = p;
      }
      if (diff < minDiff) {
        minDiff = diff;
        bl = p;
      }
    }

    const normTl = { x: tl.x / w, y: tl.y / h };
    const normTr = { x: tr.x / w, y: tr.y / h };
    const normBl = { x: bl.x / w, y: bl.y / h };
    const normBr = { x: br.x / w, y: br.y / h };

    // Validate size
    const dist = (p1: Point2D, p2: Point2D) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const wTop = dist(normTl, normTr);
    const wBottom = dist(normBl, normBr);
    const hLeft = dist(normTl, normBl);
    const hRight = dist(normTr, normBr);

    if (wTop < 0.15 || wBottom < 0.15 || hLeft < 0.15 || hRight < 0.15) {
      return null;
    }

    // Convexity check
    const crossProduct = (a: Point2D, b: Point2D, c: Point2D) => {
      return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    };
    const cp1 = crossProduct(normTl, normTr, normBr);
    const cp2 = crossProduct(normTr, normBr, normBl);
    const cp3 = crossProduct(normBr, normBl, normTl);
    const cp4 = crossProduct(normBl, normTl, normTr);

    const isConvex = (cp1 > 0 && cp2 > 0 && cp3 > 0 && cp4 > 0) || (cp1 < 0 && cp2 < 0 && cp3 < 0 && cp4 < 0);
    if (!isConvex) {
      return null;
    }

    return {
      topLeft: normTl,
      topRight: normTr,
      bottomLeft: normBl,
      bottomRight: normBr,
      confidence: 0.95
    };
  } catch (err) {
    console.warn("detectCornersFromSource failed (possible canvas tainted error):", err);
    return null;
  }
};

export const warpPerspective = (
  sourceCanvas: HTMLCanvasElement,
  corners: DocumentBounds
): HTMLCanvasElement => {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  const dist = (p1: Point2D, p2: Point2D) => Math.hypot((p2.x - p1.x) * srcW, (p2.y - p1.y) * srcH);
  
  const widthTop = dist(corners.topLeft, corners.topRight);
  const widthBottom = dist(corners.bottomLeft, corners.bottomRight);
  const destW = Math.round((widthTop + widthBottom) / 2);

  const heightLeft = dist(corners.topLeft, corners.bottomLeft);
  const heightRight = dist(corners.topRight, corners.bottomRight);
  const destH = Math.round((heightLeft + heightRight) / 2);

  if (destW < 10 || destH < 10) return sourceCanvas;

  const destCanvas = document.createElement('canvas');
  destCanvas.width = destW;
  destCanvas.height = destH;
  const destCtx = destCanvas.getContext('2d');
  const srcCtx = sourceCanvas.getContext('2d');
  if (!destCtx || !srcCtx) return sourceCanvas;

  const srcData = srcCtx.getImageData(0, 0, srcW, srcH);
  const destData = destCtx.createImageData(destW, destH);

  const x0 = corners.topLeft.x * srcW;
  const y0 = corners.topLeft.y * srcH;
  const x1 = corners.topRight.x * srcW;
  const y1 = corners.topRight.y * srcH;
  const x2 = corners.bottomRight.x * srcW;
  const y2 = corners.bottomRight.y * srcH;
  const x3 = corners.bottomLeft.x * srcW;
  const y3 = corners.bottomLeft.y * srcH;

  let g = 0;
  let h = 0;
  
  const det = (x1 - x2) * (y3 - y2) - (x3 - x2) * (y1 - y2);
  if (Math.abs(det) >= 0.0001) {
    const dx3 = x0 - x1 - x3 + x2;
    const dy3 = y0 - y1 - y3 + y2;
    g = (dx3 * (y3 - y2) - (x3 - x2) * dy3) / det;
    h = ((x1 - x2) * dy3 - dx3 * (y1 - y2)) / det;
  }

  const a = g * x1 + x1 - x0;
  const b = h * x3 + x3 - x0;
  const c = x0;
  const d = g * y1 + y1 - y0;
  const e = h * y3 + y3 - y0;
  const f = y0;

  const srcPixels = new Uint32Array(srcData.data.buffer);
  const destPixels = new Uint32Array(destData.data.buffer);

  for (let v = 0; v < destH; v++) {
    const vn = v / destH;
    const rowOffset = v * destW;
    
    for (let u = 0; u < destW; u++) {
      const un = u / destW;
      const denominator = g * un + h * vn + 1;
      const sx = Math.round((a * un + b * vn + c) / denominator);
      const sy = Math.round((d * un + e * vn + f) / denominator);

      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        destPixels[rowOffset + u] = srcPixels[sy * srcW + sx];
      } else {
        destPixels[rowOffset + u] = 0xFFFFFFFF; // White fallback
      }
    }
  }

  destCtx.putImageData(destData, 0, 0);
  return destCanvas;
};

export const autoCropDocument = (base64Image: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    
    // Set a safety timeout of 3500ms
    const timeoutId = setTimeout(() => {
      console.warn("autoCropDocument timed out loading image, returning original image");
      img.onload = null;
      img.onerror = null;
      resolve(base64Image);
    }, 3500);

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Image);

        // Resize image to max 1200px to maintain performance and avoid crashes/stalls on mobile
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const corners = detectCornersFromSource(canvas);
        if (corners) {
          try {
            const warpedCanvas = warpPerspective(canvas, corners);
            resolve(warpedCanvas.toDataURL('image/jpeg', 0.9));
            return;
          } catch (e) {
            console.error("Warp perspective failed, falling back to simple crop", e);
          }
        }

        // Fallback: estimate background color & crop bounding box using standard scanning
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;
        
        let borderR = 0, borderG = 0, borderB = 0;
        let borderSampleCount = 0;
        
        for (let x = 0; x < canvas.width; x += 10) {
          let i = x * 4;
          borderR += data[i]; borderG += data[i+1]; borderB += data[i+2];
          borderSampleCount++;
          i = ((canvas.height - 1) * canvas.width + x) * 4;
          borderR += data[i]; borderG += data[i+1]; borderB += data[i+2];
          borderSampleCount++;
        }
        for (let y = 0; y < canvas.height; y += 10) {
          let i = (y * canvas.width) * 4;
          borderR += data[i]; borderG += data[i+1]; borderB += data[i+2];
          borderSampleCount++;
          i = (y * canvas.width + canvas.width - 1) * 4;
          borderR += data[i]; borderG += data[i+1]; borderB += data[i+2];
          borderSampleCount++;
        }
        
        borderR /= borderSampleCount; 
        borderG /= borderSampleCount; 
        borderB /= borderSampleCount;

        const borderThreshold = 40;
        let foundContent = false;
        const step = Math.max(2, Math.floor(canvas.width / 500));
        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            const diff = Math.abs(r - borderR) + Math.abs(g - borderG) + Math.abs(b - borderB);
            if (diff > borderThreshold * 3) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
              foundContent = true;
            }
          }
        }

        const padding = Math.floor(Math.min(canvas.width, canvas.height) * 0.05);
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width, maxX + padding);
        maxY = Math.min(canvas.height, maxY + padding);

        const croppedWidth = maxX - minX;
        const croppedHeight = maxY - minY;
        const cropArea = croppedWidth * croppedHeight;
        const originalArea = canvas.width * canvas.height;
        
        if (foundContent && cropArea > originalArea * 0.2 && cropArea < originalArea * 0.95) {
          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = croppedWidth;
          croppedCanvas.height = croppedHeight;
          const croppedCtx = croppedCanvas.getContext('2d');
          if (croppedCtx) {
            croppedCtx.fillStyle = '#FFFFFF';
            croppedCtx.fillRect(0,0,croppedWidth, croppedHeight);
            croppedCtx.drawImage(
              canvas, 
              minX, minY, croppedWidth, croppedHeight,
              0, 0, croppedWidth, croppedHeight
            );
            resolve(croppedCanvas.toDataURL('image/jpeg', 0.9));
            return;
          }
        }

        resolve(base64Image);
      } catch (err) {
        console.error("autoCropDocument processing error:", err);
        resolve(base64Image);
      }
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(base64Image);
    };
    img.src = base64Image;
  });
};

// Add stability detection for auto capture feature
let previousImageData: Uint8ClampedArray | null = null;

export const checkStabilityForAutoCapture = (
  videoElement: HTMLVideoElement, 
  canvasElement: HTMLCanvasElement
): boolean => {
  try {
    const ctx = canvasElement.getContext('2d');
    if (!ctx || videoElement.videoWidth === 0) return false;

    canvasElement.width = 100;
    canvasElement.height = 100;
    ctx.drawImage(videoElement, 0, 0, 100, 100);
    
    const currentImageData = ctx.getImageData(0, 0, 100, 100).data;
    
    if (!previousImageData) {
      previousImageData = new Uint8ClampedArray(currentImageData);
      return false;
    }

    let totalDiff = 0;
    for (let i = 0; i < currentImageData.length; i += 4) {
      totalDiff += Math.abs(currentImageData[i] - previousImageData[i]);
    }
    
    const avgDiff = totalDiff / (currentImageData.length / 4);
    previousImageData = new Uint8ClampedArray(currentImageData);
    
    return avgDiff < 25.0; 
  } catch (err) {
    console.warn("checkStabilityForAutoCapture failed (possible tainted canvas):", err);
    return false;
  }
};

export const rotateImage = (base64Image: string, degrees: number = 90): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Image);

      if (degrees % 180 !== 0) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => {
      resolve(base64Image);
    };
    img.src = base64Image;
  });
};

// ==========================================
// DOCUMENT IMAGE FILTERS (CLEAR & VISIBLE)
// ==========================================

export type FilterType = 'original' | 'clear' | 'bw' | 'grayscale' | 'brighten';

export interface FilterOptions {
  filter: FilterType;
  brightness?: number; // Range -50 to +50, default 0
  contrast?: number;   // Range -50 to +50, default 0
}

interface BackgroundMap {
  grid: Float32Array;
  gw: number;
  gh: number;
  blockSize: number;
}

/**
 * Computes an adaptive background illumination grid for shadow and uneven lighting correction.
 */
function computeBackgroundMap(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number = 48
): BackgroundMap {
  const gw = Math.ceil(width / blockSize);
  const gh = Math.ceil(height / blockSize);
  const grid = new Float32Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    const startY = gy * blockSize;
    const endY = Math.min(height, startY + blockSize);
    for (let gx = 0; gx < gw; gx++) {
      const startX = gx * blockSize;
      const endX = Math.min(width, startX + blockSize);

      // Collect sample luminances across the block to estimate paper background level
      const samples: number[] = [];
      const step = Math.max(2, Math.floor(blockSize / 8));
      for (let y = startY; y < endY; y += step) {
        const row = y * width;
        for (let x = startX; x < endX; x += step) {
          const idx = (row + x) * 4;
          const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          samples.push(lum);
        }
      }

      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        // Use the 90th percentile to isolate paper background without text interference
        const pIdx = Math.floor(samples.length * 0.90);
        grid[gy * gw + gx] = Math.max(75, samples[pIdx]);
      } else {
        grid[gy * gw + gx] = 200;
      }
    }
  }

  // Smooth the grid with 3x3 box blur to ensure smooth lighting transitions
  const smoothed = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = gy + dy;
        if (ny < 0 || ny >= gh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = gx + dx;
          if (nx < 0 || nx >= gw) continue;
          sum += grid[ny * gw + nx];
          count++;
        }
      }
      smoothed[gy * gw + gx] = count > 0 ? sum / count : grid[gy * gw + gx];
    }
  }

  return { grid: smoothed, gw, gh, blockSize };
}

/**
 * Bilinear interpolation of background illumination at pixel (x, y)
 */
function getInterpolatedBg(x: number, y: number, bgMap: BackgroundMap): number {
  const { grid, gw, gh, blockSize } = bgMap;
  const gx = (x + 0.5) / blockSize - 0.5;
  const gy = (y + 0.5) / blockSize - 0.5;
  const gx0 = Math.max(0, Math.min(gw - 1, Math.floor(gx)));
  const gx1 = Math.min(gw - 1, gx0 + 1);
  const gy0 = Math.max(0, Math.min(gh - 1, Math.floor(gy)));
  const gy1 = Math.min(gh - 1, gy0 + 1);
  const fx = Math.max(0, Math.min(1, gx - gx0));
  const fy = Math.max(0, Math.min(1, gy - gy0));

  const g00 = grid[gy0 * gw + gx0];
  const g10 = grid[gy0 * gw + gx1];
  const g01 = grid[gy1 * gw + gx0];
  const g11 = grid[gy1 * gw + gx1];

  return (1 - fx) * (1 - fy) * g00 + fx * (1 - fy) * g10 + (1 - fx) * fy * g01 + fx * fy * g11;
}

/**
 * Applies unsharp mask sharpening to the pixel data to make text razor sharp.
 */
function applyUnsharpMask(
  srcData: Uint8ClampedArray,
  dstData: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number = 0.35
) {
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    const rowPrev = (y - 1) * width;
    const rowNext = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (row + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = srcData[idx + c];
        const blur = (
          srcData[(rowPrev + x) * 4 + c] +
          srcData[(rowNext + x) * 4 + c] +
          srcData[(row + x - 1) * 4 + c] +
          srcData[(row + x + 1) * 4 + c]
        ) * 0.25;
        const sharp = center + (center - blur) * amount;
        dstData[idx + c] = sharp < 0 ? 0 : sharp > 255 ? 255 : Math.round(sharp);
      }
      dstData[idx + 3] = 255;
    }
  }
}

/**
 * Core image processing logic on ImageData.
 */
export function applyFilterToImageData(
  imageData: ImageData,
  options: FilterOptions
): ImageData {
  const { filter, brightness = 0, contrast = 0 } = options;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Build brightness/contrast LUT
  const b = Math.max(-50, Math.min(50, brightness));
  const c = Math.max(-50, Math.min(50, contrast));
  const hasAdjustments = b !== 0 || c !== 0;
  let lut: Uint8ClampedArray | null = null;
  if (hasAdjustments) {
    lut = new Uint8ClampedArray(256);
    const factor = (259 * (c + 255)) / (255 * (259 - c));
    for (let i = 0; i < 256; i++) {
      const adjusted = factor * (i - 128) + 128 + b * 1.5;
      lut[i] = Math.max(0, Math.min(255, Math.round(adjusted)));
    }
  }

  if (filter === 'original') {
    if (lut) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = lut[data[i]];
        data[i + 1] = lut[data[i + 1]];
        data[i + 2] = lut[data[i + 2]];
      }
    }
    return imageData;
  }

  // Adaptive background illumination map for shadow removal & whitening
  const bgMap = computeBackgroundMap(data, width, height, Math.max(32, Math.floor(Math.min(width, height) / 20)));

  // Output buffer
  const intermediate = new Uint8ClampedArray(data.length);

  if (filter === 'clear') {
    // CLEAR & VISIBLE: Magic Color
    // 1. Remove shadows & paper yellowing by dividing local background
    // 2. Paper whitening (>205) + text darkening (<150)
    // 3. Preserve signature/stamp colors with slight saturation boost
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = (row + x) * 4;
        const bg = getInterpolatedBg(x, y, bgMap);
        const normFactor = 255 / Math.max(70, bg);

        let r = Math.min(255, data[idx] * normFactor);
        let g = Math.min(255, data[idx + 1] * normFactor);
        let bVal = Math.min(255, data[idx + 2] * normFactor);

        const lum = r * 0.299 + g * 0.587 + bVal * 0.114;

        if (lum > 200) {
          // Push paper background to clean white
          const t = (lum - 200) / 55;
          const mult = 1 + t * 0.28;
          r = Math.min(255, r * mult);
          g = Math.min(255, g * mult);
          bVal = Math.min(255, bVal * mult);
        } else if (lum < 150) {
          // Deepen dark text/ink to make letters bold and clear
          const darkT = lum / 150;
          const darkMult = 0.76 + darkT * 0.24;
          r = r * darkMult;
          g = g * darkMult;
          bVal = bVal * darkMult;
        }

        // Saturation preservation (keeps blue pen, stamps, logos crisp)
        const finalLum = r * 0.299 + g * 0.587 + bVal * 0.114;
        const sat = 1.15;
        r = Math.max(0, Math.min(255, finalLum + (r - finalLum) * sat));
        g = Math.max(0, Math.min(255, finalLum + (g - finalLum) * sat));
        bVal = Math.max(0, Math.min(255, finalLum + (bVal - finalLum) * sat));

        intermediate[idx] = r;
        intermediate[idx + 1] = g;
        intermediate[idx + 2] = bVal;
        intermediate[idx + 3] = 255;
      }
    }

    // Apply sharpening so edges and characters pop
    applyUnsharpMask(intermediate, data, width, height, 0.4);

  } else if (filter === 'bw') {
    // B&W DOCUMENT: Pure black text on clean white paper
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = (row + x) * 4;
        const bg = getInterpolatedBg(x, y, bgMap);
        const normFactor = 255 / Math.max(70, bg);

        const r = data[idx] * normFactor;
        const g = data[idx + 1] * normFactor;
        const bVal = data[idx + 2] * normFactor;
        const lum = r * 0.299 + g * 0.587 + bVal * 0.114;

        // Smooth anti-aliased threshold for smooth font edges without aliasing
        const tLow = 150;
        const tHigh = 195;
        let val: number;
        if (lum <= tLow) {
          val = 0;
        } else if (lum >= tHigh) {
          val = 255;
        } else {
          val = Math.round(((lum - tLow) / (tHigh - tLow)) * 255);
        }

        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

  } else if (filter === 'grayscale') {
    // CRISP GRAYSCALE: High clarity monochrome
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = (row + x) * 4;
        const bg = getInterpolatedBg(x, y, bgMap);
        const normFactor = 255 / Math.max(70, bg);

        const r = data[idx] * normFactor;
        const g = data[idx + 1] * normFactor;
        const bVal = data[idx + 2] * normFactor;
        let lum = r * 0.299 + g * 0.587 + bVal * 0.114;

        if (lum > 200) {
          lum = 200 + (lum - 200) * 1.4;
        } else if (lum < 140) {
          lum = lum * 0.82;
        }

        const val = Math.max(0, Math.min(255, Math.round(lum)));
        intermediate[idx] = val;
        intermediate[idx + 1] = val;
        intermediate[idx + 2] = val;
        intermediate[idx + 3] = 255;
      }
    }

    applyUnsharpMask(intermediate, data, width, height, 0.35);

  } else if (filter === 'brighten') {
    // BRIGHTEN: Lifts dark shadows & low light photos
    const gamma = 0.72;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const norm = data[i + c] / 255;
        const boosted = Math.pow(norm, gamma) * 1.15;
        data[i + c] = Math.max(0, Math.min(255, Math.round(boosted * 255)));
      }
    }
  }

  // Apply fine-tuned brightness/contrast if specified
  if (lut) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  }

  return imageData;
}

/**
 * Applies a filter to an existing HTMLCanvasElement.
 */
export function applyFilterToCanvas(
  canvas: HTMLCanvasElement,
  options: FilterOptions
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyFilterToImageData(imageData, options);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Asynchronously applies filter options to a base64 / URL image and resolves to enhanced JPEG data URL.
 */
export const applyImageFilter = (
  imageSource: string,
  options: FilterOptions
): Promise<string> => {
  return new Promise((resolve) => {
    // Fast path: original with no brightness/contrast adjustments
    if (options.filter === 'original' && (!options.brightness) && (!options.contrast)) {
      return resolve(imageSource);
    }

    const img = new Image();
    const timeout = setTimeout(() => {
      resolve(imageSource);
    }, 4000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSource);

        ctx.drawImage(img, 0, 0);
        applyFilterToCanvas(canvas, options);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.error("applyImageFilter processing error:", err);
        resolve(imageSource);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(imageSource);
    };

    img.src = imageSource;
  });
};
