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
