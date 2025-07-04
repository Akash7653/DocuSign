// client/src/components/PDFViewerWithSignature.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'; // Required for PDF links/annotations
import 'react-pdf/dist/esm/Page/TextLayer.css';     // Required for selectable text
import { FaEraser, FaFont, FaImage, FaSave, FaDownload, FaTimes, FaPlus, FaMinus, FaArrowRight, FaArrowLeft, FaSignature, FaPaintBrush } from 'react-icons/fa';

// Configure PDF.js worker source globally
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.6.172/build/pdf.worker.min.js`;

const PDFViewerWithSignature = ({
  fileUrl,
  onPlaceSignature,
  onDeleteSignature,
  onFinalize,
  signatures, // Array of existing signatures for the current document, fetched from backend
}) => {
  const viewerRef = useRef(); // Ref for the main PDF viewer container (for mouse events, e.g., mouse leave)
  const pdfPageContainerRef = useRef(); // Ref for the div that wraps the PDF.js <canvas> element

  const [numPages, setNumPages] = useState(null); // Total number of pages in the PDF
  const [currentPage, setCurrentPage] = useState(1); // Currently displayed page number (1-indexed)
  const [pageInput, setPageInput] = useState(1); // State for the page number input field
  const [pdfRenderedWidth, setPdfRenderedWidth] = useState(0); // Actual rendered width of the PDF page at current scale
  const [pdfRenderedHeight, setPdfRenderedHeight] = useState(0); // Actual rendered height of the PDF page at current scale
  const [scale, setScale] = useState(0.7); // Zoom level for the PDF (1.0 = 100%)

  // State for the *new* signature being created/dragged before it's saved to the backend
  const [signatureType, setSignatureType] = useState('Typed'); // Current signature creation mode: 'Typed', 'Drawn', 'Image'
  const [typedText, setTypedText] = useState(''); // Text for 'Typed' signatures
  const [font, setFont] = useState('Arial'); // Font for 'Typed' signatures
  const [fontSize, setFontSize] = useState(24); // Font size for 'Typed' signatures
  const [color, setColor] = useState('#000000'); // Color for 'Typed' and 'Drawn' signatures
  const [drawImage, setDrawImage] = useState(null); // Base64 URL of the drawn signature (from canvas)
  const [uploadedImage, setUploadedImage] = useState(null); // Base64 URL of the uploaded image
  const [imageSize, setImageSize] = useState(100); // Desired width for 'Image' signatures

  const [newSignatureContent, setNewSignatureContent] = useState(null); // Unified content object for the new signature preview
  const [newSignaturePosition, setNewSignaturePosition] = useState({ x: 0, y: 0 }); // Pixel position for the new signature preview (relative to PDF page)
  const [isDraggingNewSignature, setIsDraggingNewSignature] = useState(false); // Flag if the new signature preview is being dragged
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Mouse position offset from preview top-left for smooth dragging

  const canvasRef = useRef(); // Ref for the drawing canvas element
  const isDrawing = useRef(false); // To track drawing state on the canvas

  // Effect to synchronize the page input field with the current page state
  useEffect(() => {
    setPageInput(currentPage);
  }, [currentPage]);

  // Effect to reset drawing canvas and new signature content when signature type changes
  useEffect(() => {
    if (signatureType === 'Drawn' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setDrawImage(null); // Clear drawn image data
    }
    // Clear the new signature preview and related input states whenever signatureType changes
    setNewSignatureContent(null);
    setTypedText('');
    setUploadedImage(null);
  }, [signatureType]);

  // Effect to set initial position and content for the new signature preview once PDF dimensions are known
  useEffect(() => {
    if (pdfRenderedWidth && pdfRenderedHeight) {
      // Place the preview roughly in the center of the PDF initially
      setNewSignaturePosition({
        x: (pdfRenderedWidth / 2) - 50, // Roughly center, adjusting for a typical 100px wide element
        y: (pdfRenderedHeight / 2) - 50, // Roughly center
      });

      // If initial content exists for typed/image, immediately create the preview
      if (signatureType === 'Typed' && typedText.trim().length > 0) {
        setNewSignatureContent({ text: typedText, font, color, fontSize });
      } else if (signatureType === 'Image' && uploadedImage) {
        setNewSignatureContent({ image: uploadedImage, size: imageSize });
      }
      // Drawn content is only set after the user actually draws something
    }
  }, [pdfRenderedWidth, pdfRenderedHeight, signatureType]); // Depend on rendered PDF dimensions and signatureType

  // Callback for successful PDF document load by react-pdf
  const onDocumentLoadSuccess = useCallback(({ numPages: totalPages }) => {
    setNumPages(totalPages);
  }, []);

  // Callback for successful PDF page render by react-pdf
  const onPageRenderSuccess = useCallback(({ width, height }) => {
    // These are the actual pixel dimensions of the rendered PDF page on screen
    setPdfRenderedWidth(width);
    setPdfRenderedHeight(height);
  }, []);

  // --- Signature Creation/Placement Logic ---

  /**
   * Handles placing the new signature. This function normalizes the coordinates
   * and calls the `onPlaceSignature` prop (which sends data to the backend).
   */
  const handlePlaceNewSignature = () => {
    if (!newSignatureContent) {
      alert('Please create content for your signature (type text, draw, or upload image) before placing.');
      return;
    }
    if (!pdfRenderedWidth || !pdfRenderedHeight) {
      alert('PDF not fully rendered. Please wait a moment.');
      return;
    }

    // Normalize coordinates (0 to 1) based on rendered PDF page dimensions
    // This makes the signature position independent of zoom level and original PDF size.
    // Frontend (0,0) is top-left.
    const previewHeight = 40; // approximate or get actual height of the preview
const normalizedX = newSignaturePosition.x / pdfRenderedWidth;
const normalizedY = (newSignaturePosition.y + previewHeight) / pdfRenderedHeight;

    // Call the parent component's prop to send the signature data to the backend
    onPlaceSignature({
      x: normalizedX,
      y: normalizedY,
      page: currentPage,
      type: signatureType,
      content: newSignatureContent,
    });

    // Clear the new signature preview and related input fields after successful placement
    setNewSignatureContent(null);
    setTypedText('');
    setDrawImage(null);
    setUploadedImage(null);
    if (canvasRef.current) { // Clear the drawing canvas if it was used
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // --- Dragging Logic for the *New* Signature Preview ---

  /**
   * Initiates the drag operation for the new signature preview.
   * @param {React.MouseEvent} e - The mouse event.
   */
  const handleStartDragNewSignature = (e) => {
    // Only start dragging if the direct target is the preview div itself, not its children (e.g., the delete button)
    if (e.target.classList.contains('new-signature-preview')) {
        // Prevent default browser drag behavior
        e.preventDefault();
        // Get the bounding rectangle of the PDF page container for coordinate calculation
        const pdfPageRect = pdfPageContainerRef.current.getBoundingClientRect();
        // Calculate the offset from the mouse click to the top-left corner of the preview
        setDragOffset({
            x: e.clientX - pdfPageRect.left - newSignaturePosition.x,
            y: e.clientY - pdfPageRect.top - newSignaturePosition.y,
        });
        setIsDraggingNewSignature(true); // Set dragging flag to true
    }
  };

  /**
   * Updates the position of the new signature preview during drag.
   * @param {React.MouseEvent} e - The mouse event.
   */
  const handleDraggingNewSignature = (e) => {
    if (!isDraggingNewSignature || !pdfPageContainerRef.current) return;

    const pdfPageRect = pdfPageContainerRef.current.getBoundingClientRect();
    // Calculate new position based on current mouse position and initial offset
    let newX = e.clientX - pdfPageRect.left - dragOffset.x;
    let newY = e.clientY - pdfPageRect.top - dragOffset.y;

    // Get current dimensions of the signature preview element to apply boundary checks
    const previewElement = viewerRef.current.querySelector('.new-signature-preview');
    const previewWidth = previewElement ? previewElement.offsetWidth : 0;
    const previewHeight = previewElement ? previewElement.offsetHeight : 0;

    // Clamp coordinates to stay within the bounds of the rendered PDF page
    newX = Math.max(0, Math.min(newX, pdfRenderedWidth - previewWidth));
    newY = Math.max(0, Math.min(newY, pdfRenderedHeight - previewHeight));

    setNewSignaturePosition({ x: newX, y: newY }); // Update the state, re-rendering the preview
  };

  /**
   * Ends the drag operation for the new signature preview.
   */
  const handleMouseUpNewSignature = () => {
    setIsDraggingNewSignature(false);
  };

  /**
   * Handles mouse leaving the main viewer area during a drag operation.
   * This is a safeguard to stop dragging if the mouse goes off the PDF.
   */
  const handleMouseLeaveViewer = () => {
    if (isDraggingNewSignature) {
      setIsDraggingNewSignature(false);
    }
  };

  // --- Drawing Functions for 'Drawn' Signature Type ---

  /**
   * Starts drawing on the canvas.
   * @param {React.MouseEvent|React.TouchEvent} e - The mouse or touch event.
   */
  const handleMouseDownDraw = (e) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color; // Set drawing color
    ctx.lineWidth = 2;       // Set line thickness
    ctx.lineCap = 'round';   // Make line ends rounded for smoother appearance
    ctx.beginPath();         // Start a new path

    // Get coordinates relative to the canvas
    const offsetX = e.nativeEvent.offsetX || (e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : 0);
    const offsetY = e.nativeEvent.offsetY || (e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : 0);
    ctx.moveTo(offsetX, offsetY); // Start drawing at mouse/touch position
  };

  /**
   * Continues drawing on the canvas.
   * @param {React.MouseEvent|React.TouchEvent} e - The mouse or touch event.
   */
  const handleMouseMoveDraw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Get coordinates relative to the canvas
    const offsetX = e.nativeEvent.offsetX || (e.touches ? e.touches[0].clientX - canvas.getBoundingClientRect().left : 0);
    const offsetY = e.nativeEvent.offsetY || (e.touches ? e.touches[0].clientY - canvas.getBoundingClientRect().top : 0);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke(); // Draw line segment
  };

  /**
   * Ends drawing on the canvas and saves the drawn image.
   */
  const handleMouseUpDraw = () => {
    isDrawing.current = false;
    setDrawImage(canvasRef.current.toDataURL()); // Save the drawn content as base64 image data URL
    setNewSignatureContent({ image: canvasRef.current.toDataURL() }); // Update the new signature preview content
  };

  /**
   * Handles mouse leaving the drawing canvas while drawing.
   * Finalizes the drawing in this scenario.
   */
  const handleMouseLeaveDraw = () => {
    if (isDrawing.current) {
      handleMouseUpDraw(); // Finalize drawing if mouse leaves the canvas area
    }
  };

  /**
   * Clears the drawing canvas and resets related states.
   */
  const handleClearDrawing = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); // Clear the canvas content
    setDrawImage(null); // Clear stored drawn image data
    setNewSignatureContent(null); // Clear the new signature preview content
  };

  // --- Input Change Handlers for Signature Content ---

  /**
   * Handles changes to the typed signature text input.
   * Updates the text content and the new signature preview.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The input change event.
   */
  const handleTypedTextChange = (e) => {
    const text = e.target.value;
    setTypedText(text);
    if (text.trim().length > 0) {
      setNewSignatureContent({ text, font, color, fontSize });
    } else {
      setNewSignatureContent(null); // Clear preview if text is empty
    }
  };

  /**
   * Updates the new typed signature content whenever font, size, or color changes.
   */
  useEffect(() => {
    if (signatureType === 'Typed' && typedText.trim().length > 0) {
      setNewSignatureContent({ text: typedText, font, color, fontSize });
    }
  }, [font, fontSize, color, typedText, signatureType]);

  /**
   * Handles file selection for image signatures.
   * Reads the selected image as a base64 data URL.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event.
   */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result); // Store the base64 string
        setNewSignatureContent({ image: reader.result, size: imageSize }); // Update preview content
      };
      reader.readAsDataURL(file); // Read file as base64 data URL
    } else {
      setUploadedImage(null);
      setNewSignatureContent(null); // Clear preview if no file selected
    }
  };

  /**
   * Updates the new image signature content when the image size slider changes.
   */
  useEffect(() => {
    if (signatureType === 'Image' && uploadedImage) {
      setNewSignatureContent({ image: uploadedImage, size: imageSize });
    }
  }, [imageSize, uploadedImage, signatureType]);

  // --- Render Functions for Signatures ---

  /**
   * Renders the preview of the NEW signature currently being created and dragged.
   * This preview is temporary and not yet saved to the database.
   * It moves with `newSignaturePosition`.
   */
  const renderNewSignaturePreview = () => {
    // Only render if there's content and PDF dimensions are known
    if (!newSignatureContent || !pdfRenderedWidth || !pdfRenderedHeight) return null;

    const baseStyle = {
      position: 'absolute',
      // Position using pixel coordinates relative to the PDF container
      top: newSignaturePosition.y,
      left: newSignaturePosition.x,
      cursor: isDraggingNewSignature ? 'grabbing' : 'grab', // Cursor feedback for dragging
      zIndex: 10, // Higher z-index to be on top of placed signatures and PDF content
      border: '2px dashed #007bff', // Visual indicator for active preview
      boxShadow: '0 0 10px rgba(0, 123, 255, 0.5)', // Blue glow
      padding: '5px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slightly transparent background
      borderRadius: '8px',
      userSelect: 'none', // Prevent text selection during drag
    };

    let contentToRender;
    if (newSignatureContent.text) {
      // Render typed text
      contentToRender = (
        <div style={{
          fontFamily: newSignatureContent.font,
          fontSize: `${newSignatureContent.fontSize}px`,
          color: newSignatureContent.color,
          fontWeight: 'bold',
          whiteSpace: 'nowrap', // Keep text on one line
        }}>
          {newSignatureContent.text}
        </div>
      );
    } else if (newSignatureContent.image) {
      // Render drawn or uploaded image
      contentToRender = (
        <img
          src={newSignatureContent.image}
          alt="signature preview"
          style={{ width: `${newSignatureContent.size || 100}px`, height: 'auto', display: 'block' }}
        />
      );
    } else {
      return null; // Should not happen if newSignatureContent is set correctly
    }

    return (
      <div
        style={baseStyle}
        onMouseDown={handleStartDragNewSignature}
        onTouchStart={handleStartDragNewSignature}
        className="new-signature-preview" // Class for drag target identification
      >
        {contentToRender}
        <button
          className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 text-xs hover:bg-red-700 transition-colors shadow-md transform scale-90 hover:scale-100"
          onClick={(e) => { e.stopPropagation(); setNewSignatureContent(null); }} // Stop propagation to prevent drag
          title="Cancel placement"
        >
          <FaTimes />
        </button>
      </div>
    );
  };

  /**
   * Renders already placed signatures fetched from the backend (`signatures` prop).
   * These signatures are fixed on the page and have a delete button.
   */
  const renderPlacedSignatures = () => {
    // Only render if PDF dimensions are known and signatures exist
    if (!pdfRenderedWidth || !pdfRenderedHeight || !signatures) return null;

    return signatures
      .filter(sig => sig.page === currentPage) // Only render signatures for the currently displayed page
      .map((sig) => {
        // Calculate actual pixel positions from normalized coordinates (0-1)
        // Frontend 'top' is relative to the top of the PDF, so 'y' corresponds directly.
        const pixelX = sig.x * pdfRenderedWidth;
        const pixelY = sig.y * pdfRenderedHeight;

        const baseStyle = {
          position: 'absolute',
          top: pixelY,
          left: pixelX,
          zIndex: 9, // Below the new signature preview, but above PDF content
          pointerEvents: 'none', // By default, prevent signatures from blocking PDF interaction
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
              pointerEvents: 'auto', // Allow delete button to be clicked
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
                width: `${sig.content.size || 100}px`, // Use stored size, default to 100px
                height: 'auto',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'auto', // Allow delete button to be clicked
              }}
            />
          );
        } else {
            return null; // Don't render if content is missing or invalid
        }

        return (
          <div key={sig._id} style={baseStyle} className="placed-signature-wrapper">
            {contentToRender}
            <button
              className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 text-xs hover:bg-red-700 transition-colors shadow-md transform scale-90 hover:scale-100"
              onClick={() => onDeleteSignature(sig._id)} // Pass signature ID for deletion
              title="Delete signature"
              style={{ pointerEvents: 'auto' }} // Ensure button is clickable
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
      onMouseLeave={handleMouseLeaveViewer} // Catch mouse leaving during drag
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
              width={300} // Fixed canvas width
              height={100} // Fixed canvas height
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
          disabled={!newSignatureContent} // Disable if no content to place
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
              e.target.blur(); // Remove focus after enter
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
          maxWidth: '100%', // Ensure it fits container
          maxHeight: '80vh', // Limit height for better viewing experience
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          // Important for consistent scaling across devices
          touchAction: 'none', // Prevents default touch actions like pan/zoom for custom drag
        }}
        ref={pdfPageContainerRef} // This ref wraps the PDF.js canvas
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex justify-center items-center" // Center the PDF within its container
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            onRenderSuccess={onPageRenderSuccess}
            renderAnnotationLayer={true} // Renders links/annotations from PDF
            renderTextLayer={true} // Renders selectable text layer
            className="shadow-xl"
          />
        </Document>

        {/* Render existing signatures */}
        {renderPlacedSignatures()}

        {/* Render the new signature preview being dragged */}
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
