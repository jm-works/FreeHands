/**
 * @param {ImageData} imgData
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function getBoundsFromImageData(imgData) {
    const { width, height, data } = imgData;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 5) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasPixels = true;
            }
        }
    }

    if (!hasPixels) return null;
    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} bbox1
 * @param {{ left: number, top: number, width: number, height: number }} bbox2
 * @returns {boolean}
 */
export function checkIntersection(bbox1, bbox2) {
    return (
        bbox1.left < bbox2.left + bbox2.width &&
        bbox1.left + bbox1.width > bbox2.left &&
        bbox1.top < bbox2.top + bbox2.height &&
        bbox1.top + bbox1.height > bbox2.top
    );
}

/**
 * @param {fabric.Object} obj
 * @returns {Promise<fabric.Object>}
 */
export function cloneObjectAsync(obj) {
    return new Promise((resolve) => {
        obj.clone((cloned) => resolve(cloned));
    });
}

/**
 * @param {string} url
 * @returns {Promise<fabric.Image>}
 */
export function createImageAsync(url) {
    return new Promise((resolve) => {
        fabric.Image.fromURL(url, (img) => resolve(img));
    });
}

/**
 * Rasterizes a Fabric object with an eraser shape applied via destination-out,
 * returning a cropped fabric.Image with the pixels removed — or null if fully erased.
 *
 * Mirrors the per-object rasterization loop in EraserBrush.createPath and
 * CutAreaManager.deleteSelection so both tools share identical pixel-destruction logic.
 *
 * @param {fabric.Object} obj            — target object on the main canvas
 * @param {fabric.Object} eraserShape    — eraser geometry (Path or Rect) in canvas coordinates
 * @param {number}        [pad=10]       — padding around objBbox for the StaticCanvas
 * @returns {Promise<{ img: fabric.Image, index: number } | { removed: true, index: number }>}
 */
export async function rasterizeWithEraser(obj, eraserShape, pad = 10) {
    const objBbox = obj.getBoundingRect();
    const cWidth = Math.ceil(objBbox.width) + pad * 2;
    const cHeight = Math.ceil(objBbox.height) + pad * 2;

    const staticCanvas = new fabric.StaticCanvas(null, {
        width: cWidth,
        height: cHeight,
        enableRetinaScaling: false
    });
    staticCanvas.viewportTransform = [1, 0, 0, 1, -objBbox.left + pad, -objBbox.top + pad];

    const clonedObj = await cloneObjectAsync(obj);
    const clonedEraser = await cloneObjectAsync(eraserShape);
    clonedEraser.set({ globalCompositeOperation: 'destination-out' });

    staticCanvas.add(clonedObj);
    staticCanvas.add(clonedEraser);
    staticCanvas.renderAll();

    const ctx = staticCanvas.getContext();
    const imgData = ctx.getImageData(0, 0, cWidth, cHeight);
    const bounds = getBoundsFromImageData(imgData);

    if (!bounds) return { removed: true };

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = bounds.width;
    croppedCanvas.height = bounds.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cWidth;
    tempCanvas.height = cHeight;
    tempCanvas.getContext('2d').putImageData(imgData, 0, 0);

    croppedCanvas.getContext('2d').drawImage(
        tempCanvas,
        bounds.left, bounds.top, bounds.width, bounds.height,
        0, 0, bounds.width, bounds.height
    );

    const img = await createImageAsync(croppedCanvas.toDataURL());
    img.set({
        left: objBbox.left - pad + bounds.left,
        top: objBbox.top - pad + bounds.top,
        layerId: obj.layerId,
        selectable: false,
        evented: false,
        opacity: obj.opacity ?? 1,
        globalCompositeOperation: obj.globalCompositeOperation || 'source-over'
    });

    return { img };
}