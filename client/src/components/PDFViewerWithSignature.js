// client/src/components/PDFViewerWithSignature.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { FaEraser, FaImage, FaSave, FaDownload, FaTimes, FaPlus, FaMinus, FaArrowRight, FaArrowLeft, FaSignature } from 'react-icons/fa';

// Configure PDF.js worker source globally
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const PDFViewerWithSignature = ({
  fileUrl,
  onPlaceSignature,
  onDeleteSignature,
  onFinalize,
  signatures,
}) => {
  const viewerRef = useRef();
  const pdfPageContainerRef = useRef();
  const canvasRef = useRef();
  const isDrawing = useRef(false);

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState(1);
  const [pdfRenderedWidth, setPdfRenderedWidth] = useState(0);
  const [pdfRenderedHeight, setPdfRenderedHeight] = useState(0);
  const [scale, setScale] = useState(0.7);

  // Signature state
  const [signatureType, setSignatureType] = useState('Typed');
  const [typedText, setTypedText] = useState('');
  const [font, setFont] = useState('Arial');
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#000000');
  const [, setDrawImage] = useState(null); // Fixed state declaration
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageSize, setImageSize] = useState(100);

  const [newSignatureContent, setNewSignatureContent] = useState(null);
  const [newSignaturePosition, setNewSignaturePosition] = useState({ x: 0, y: 0 });
  const [isDraggingNewSignature, setIsDraggingNewSignature] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Effect hooks
  useEffect(() => {
    setPageInput(currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (signatureType === 'Drawn' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setDrawImage(null);
    }
    setNewSignatureContent(null);
    setTypedText('');
    setUploadedImage(null);
  }, [signatureType, setDrawImage]); // Added setDrawImage to dependencies

  useEffect(() => {
    if (pdfRenderedWidth && pdfRenderedHeight) {
      setNewSignaturePosition({
        x: (pdfRenderedWidth / 2) - 50,
        y: (pdfRenderedHeight / 2) - 50,
      });

      if (signatureType === 'Typed' && typedText.trim().length > 0) {
        setNewSignatureContent({ text: typedText, font, color, fontSize });
      } else if (signatureType === 'Image' && uploadedImage) {
        setNewSignatureContent({ image: uploadedImage, size: imageSize });
      }
    }
  }, [pdfRenderedWidth, pdfRenderedHeight, signatureType, typedText, font, color, fontSize, uploadedImage, imageSize]); // Added all dependencies

  // Document and page handlers
  const onDocumentLoadSuccess = useCallback(({ numPages: totalPages }) => {
    setNumPages(totalPages);
  }, []);

  const onPageRenderSuccess = useCallback(({ width, height }) => {
    setPdfRenderedWidth(width);
    setPdfRenderedHeight(height);
  }, []);

  // Signature placement
  const handlePlaceNewSignature = () => {
    if (!newSignatureContent) {
      alert('Please create content for your signature before placing.');
      return;
    }
    if (!pdfRenderedWidth || !pdfRenderedHeight) {
      alert('PDF not fully rendered. Please wait a moment.');
      return;
    }

    const previewHeight = 40;
    const normalizedX = newSignaturePosition.x / pdfRenderedWidth;
    const normalizedY = (newSignaturePosition.y + previewHeight) / pdfRenderedHeight;

    onPlaceSignature({
      x: normalizedX,
      y: normalizedY,
      page: currentPage,
      type: signatureType,
      content: newSignatureContent,
    });

    setNewSignatureContent(null);
    setTypedText('');
    setDrawImage(null);
    setUploadedImage(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Dragging handlers
  const handleStartDragNewSignature = (e) => {
    if (e.target.classList.contains('new-signature-preview')) {
      e.preventDefault();
      const pdfPageRect = pdfPageContainerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - pdfPageRect.left - newSignaturePosition.x,
        y: e.clientY - pdfPageRect.top - newSignaturePosition.y,
      });
      setIsDraggingNewSignature(true);
    }
  };

  const handleDraggingNewSignature = (e) => {
    if (!isDraggingNewSignature || !pdfPageContainerRef.current) return;

    const pdfPageRect = pdfPageContainerRef.current.getBoundingClientRect();
    let newX = e.clientX - pdfPageRect.left - dragOffset.x;
    let newY = e.clientY - pdfPageRect.top - dragOffset.y;

    const previewElement = viewerRef.current.querySelector('.new-signature-preview');
    const previewWidth = previewElement ? previewElement.offsetWidth : 0;
    const previewHeight = previewElement ? previewElement.offsetHeight : 0;

    newX = Math.max(0, Math.min(newX, pdfRenderedWidth - previewWidth));
    newY = Math.max(0, Math.min(newY, pdfRenderedHeight - previewHeight));

    setNewSignaturePosition({ x: newX, y: newY });
  };

  const handleMouseUpNewSignature = () => {
    setIsDraggingNewSignature(false);
  };

  const handleMouseLeaveViewer = () => {
    if (isDraggingNewSignature) {
      setIsDraggingNewSignature(false);
    }
  };

  // Drawing handlers
  const handleMouseDownDraw = (e) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const offsetX = e.nativeEvent.offsetX || (e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : 0);
    const offsetY = e.nativeEvent.offsetY || (e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : 0);
    ctx.moveTo(offsetX, offsetY);
  };

  const handleMouseMoveDraw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const offsetX = e.nativeEvent.offsetX || (e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : 0);
    const offsetY = e.nativeEvent.offsetY || (e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : 0);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const handleMouseUpDraw = () => {
    isDrawing.current = false;
    const imageData = canvasRef.current.toDataURL();
    setDrawImage(imageData);
    setNewSignatureContent({ image: imageData });
  };

  const handleMouseLeaveDraw = () => {
    if (isDrawing.current) {
      handleMouseUpDraw();
    }
  };

  const handleClearDrawing = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setDrawImage(null);
    setNewSignatureContent(null);
  };

  // Input handlers
  const handleTypedTextChange = (e) => {
    const text = e.target.value;
    setTypedText(text);
    if (text.trim().length > 0) {
      setNewSignatureContent({ text, font, color, fontSize });
    } else {
      setNewSignatureContent(null);
    }
  };

  useEffect(() => {
    if (signatureType === 'Typed' && typedText.trim().length > 0) {
      setNewSignatureContent({ text: typedText, font, color, fontSize });
    }
  }, [font, fontSize, color, typedText, signatureType]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setNewSignatureContent({ image: reader.result, size: imageSize });
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedImage(null);
      setNewSignatureContent(null);
    }
  };

  useEffect(() => {
    if (signatureType === 'Image' && uploadedImage) {
      setNewSignatureContent({ image: uploadedImage, size: imageSize });
    }
  }, [imageSize, uploadedImage, signatureType]);

  // Render functions
  const renderNewSignaturePreview = () => {
    if (!newSignatureContent || !pdfRenderedWidth || !pdfRenderedHeight) return null;

    const baseStyle = {
      position: 'absolute',
      top: newSignaturePosition.y,
      left: newSignaturePosition.x,
      cursor: isDraggingNewSignature ? 'grabbing' : 'grab',
      zIndex: 10,
      border: '2px dashed #007bff',
      boxShadow: '0 0 10px rgba(0, 123, 255, 0.5)',
      padding: '5px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '8px',
      userSelect: 'none',
    };

    let contentToRender;
    if (newSignatureContent.text) {
      contentToRender = (
        <div style={{
          fontFamily: newSignatureContent.font,
          fontSize: `${newSignatureContent.fontSize}px`,
          color: newSignatureContent.color,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        }}>
          {newSignatureContent.text}
        </div>
      );
    } else if (newSignatureContent.image) {
      contentToRender = (
        <img
          src={newSignatureContent.image}
          alt="signature preview"
          style={{ width: `${newSignatureContent.size || 100}px`, height: 'auto', display: 'block' }}
        />
      );
    } else {
      return null;
    }

    return (
      <div
        style={baseStyle}
        onMouseDown={handleStartDragNewSignature}
        onTouchStart={handleStartDragNewSignature}
        className="new-signature-preview"
      >
        {contentToRender}
        <button
          className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 text-xs hover:bg-red-700 transition-colors shadow-md transform scale-90 hover:scale-100"
          onClick={(e) => { e.stopPropagation(); setNewSignatureContent(null); }}
          title="Cancel placement"
        >
          <FaTimes />
        </button>
      </div>
    );
  };

  const renderPlacedSignatures = () => {
    if (!pdfRenderedWidth || !pdfRenderedHeight || !signatures) return null;

    return signatures
      .filter(sig => sig.page === currentPage)
      .map((sig) => {
        const pixelX = sig.x * pdfRenderedWidth;
        const pixelY = sig.y * pdfRenderedHeight;

        const baseStyle = {
          position: 'absolute',
          top: pixelY,
          left: pixelX,
          zIndex: 9,
          pointerEvents: 'none',
        };

        let contentToRender;
        if (sig.type === 'Typed' && sig.content?.text) {
          contentToRender = (
            <div style={{
              fontFamily: sig.content.font,
              fontSize: `${sig.content.fontSize}px`,
              color: sig.content.color,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}>
              {sig.content.text}
            </div>
          );
        } else if ((sig.type === 'Drawn' || sig.type === 'Image') && sig.content?.image) {
          contentToRender = (
            <img
              src={sig.content.image}
              alt="placed signature"
              style={{
                width: `${sig.content.size || 100}px`,
                height: 'auto',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'auto',
              }}
            />
          );
        } else {
          return null;
        }

        return (
          <div key={sig._id} style={baseStyle} className="placed-signature-wrapper">
            {contentToRender}
            <button
              className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 text-xs hover:bg-red-700 transition-colors shadow-md transform scale-90 hover:scale-100"
              onClick={() => onDeleteSignature(sig._id)}
              title="Delete signature"
              style={{ pointerEvents: 'auto' }}
            >
              <FaTimes />
            </button>
          </div>
        );
      });
  };

  return (
    <div
      ref={viewerRef}
      className="relative border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-800 shadow-xl w-full flex flex-col items-center font-inter transition-colors duration-300"
      onMouseMove={handleDraggingNewSignature}
      onMouseUp={handleMouseUpNewSignature}
      onMouseLeave={handleMouseLeaveViewer}
      onTouchMove={handleDraggingNewSignature}
      onTouchEnd={handleMouseUpNewSignature}
      onTouchCancel={handleMouseLeaveViewer}
    >
      {/* Signature Controls Section */}
      <div className="mb-6 w-full max-w-5xl bg-white dark:bg-gray-700 p-5 rounded-lg shadow-md border border-blue-100 dark:border-gray-600 flex flex-wrap items-center justify-center gap-4 transition-colors duration-300">
        <label className="flex items-center space-x-2 font-semibold text-gray-700 dark:text-gray-300">
          <span className="text-blue-600 dark:text-blue-300"><FaSignature /></span>
          <span>Signature Type:</span>
        </label>
        <select
          value={signatureType}
          onChange={(e) => setSignatureType(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm transition"
        >
          <option value="Typed">Typed</option>
          <option value="Drawn">Drawn</option>
          <option value="Image">Image</option>
        </select>

        {/* Controls for Typed Signature */}
        {signatureType === 'Typed' && (
          <>
            <input
              placeholder="Your Name / Text for Signature"
              value={typedText}
              onChange={handleTypedTextChange}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm w-full sm:w-auto flex-grow"
            />
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            >
              <option value="Arial">Arial</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Verdana">Verdana</option>
            </select>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer"
              title="Choose text color"
            />
            <input
              type="number"
              min="10"
              max="72"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 p-2 rounded-md text-center focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              title="Font Size"
            />
          </>
        )}

        {/* Controls for Drawn Signature */}
        {signatureType === 'Drawn' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <canvas
              ref={canvasRef}
              width={300}
              height={100}
              className="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 cursor-crosshair shadow-inner flex-shrink-0"
              onMouseDown={handleMouseDownDraw}
              onMouseMove={handleMouseMoveDraw}
              onMouseUp={handleMouseUpDraw}
              onMouseLeave={handleMouseLeaveDraw}
              onTouchStart={handleMouseDownDraw}
              onTouchMove={handleMouseMoveDraw}
              onTouchEnd={handleMouseUpDraw}
              onTouchCancel={handleMouseLeaveDraw}
            />
            <div className="flex flex-row sm:flex-col gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer"
                title="Choose pen color"
              />
              <button
                onClick={handleClearDrawing}
                className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md transform hover:scale-105"
                title="Clear Drawing"
              >
                <FaEraser />
              </button>
            </div>
          </div>
        )}

        {/* Controls for Image Signature */}
        {signatureType === 'Image' && (
          <>
            <label className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors shadow-sm border border-gray-300 dark:border-gray-500">
              <FaImage className="text-blue-500 dark:text-blue-300" />
              <span>{uploadedImage ? 'Change Image' : 'Upload Image'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            {uploadedImage && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="text-sm">Size:</span>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={imageSize}
                  onChange={(e) => setImageSize(parseInt(e.target.value))}
                  className="w-24 accent-blue-600 dark:accent-blue-400"
                  title="Adjust image size (width)"
                />
                <span className="text-sm">({imageSize}px)</span>
              </div>
            )}
          </>
        )}

        {/* Place Signature Button */}
        <button
          onClick={handlePlaceNewSignature}
          className="bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold px-6 py-2 rounded-lg shadow-lg hover:from-green-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
          disabled={!newSignatureContent}
        >
          <FaSave /> Place Signature
        </button>
      </div>

      {/* Pagination and Zoom Controls Section */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-4 bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 transition-colors duration-300">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <FaArrowLeft /> Prev
        </button>
        <input
          type="number"
          value={pageInput}
          min="1"
          max={numPages || 1}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const pg = parseInt(pageInput);
              if (pg >= 1 && pg <= numPages) setCurrentPage(pg);
              e.target.blur();
            }
          }}
          className="w-20 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 p-2 rounded-md text-center focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          aria-label={`Current page out of ${numPages || 0}`}
        />
        <span className="text-gray-700 dark:text-gray-300 font-medium">/ {numPages || '0'}</span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage === numPages}
          className="bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          Next <FaArrowRight />
        </button>
        <div className="ml-4 flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <span className="font-medium">Zoom:</span>
          <button
            onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
            className="p-2 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-gray-700 dark:text-gray-200"
            title="Zoom Out"
          ><FaMinus /></button>
          <span className="font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(prev => Math.min(3.0, prev + 0.25))}
            className="p-2 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-gray-700 dark:text-gray-200"
            title="Zoom In"
          ><FaPlus /></button>
        </div>
      </div>

      {/* PDF Viewer Area */}
      <div
        className="relative border-4 border-blue-300 dark:border-blue-700 rounded-lg overflow-hidden shadow-2xl bg-white dark:bg-gray-900 mb-6 transition-colors duration-300"
        style={{
          width: pdfRenderedWidth ? `${pdfRenderedWidth}px` : '100%',
          height: pdfRenderedHeight ? `${pdfRenderedHeight}px` : 'auto',
          maxWidth: '100%',
          maxHeight: '80vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          touchAction: 'none',
        }}
        ref={pdfPageContainerRef}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex justify-center items-center"
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            onRenderSuccess={onPageRenderSuccess}
            renderAnnotationLayer={true}
            renderTextLayer={true}
            className="shadow-xl"
          />
        </Document>

        {renderPlacedSignatures()}
        {renderNewSignaturePreview()}
      </div>

      {/* Finalize Button */}
      {onFinalize && (
        <button
          onClick={onFinalize}
          className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-bold px-8 py-3 rounded-lg shadow-xl hover:from-purple-700 hover:to-indigo-800 transition-all duration-300 transform hover:scale-105 flex items-center gap-2 text-lg"
          title="Finalize PDF and download with all signatures embedded"
        >
          <FaDownload /> Finalize PDF & Download
        </button>
      )}
    </div>
  );
};

export default PDFViewerWithSignature;