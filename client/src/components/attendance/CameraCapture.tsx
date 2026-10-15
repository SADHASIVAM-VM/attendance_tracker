import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Upload,
  SwitchCamera,
  Play,
  Zap,
  Image as ImageIcon,
  Sliders,
  HelpCircle,
  Info,
} from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (blob: Blob, dataUrl: string) => void;
  onRetake: () => void;
  capturedDataUrl: string | null;
}

interface VideoDevice {
  deviceId: string;
  label: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onRetake,
  capturedDataUrl,
}) => {
  // Capture Mode: 'live' | 'upload' | 'demo'
  const [activeTab, setActiveTab] = useState<'live' | 'upload' | 'demo'>('live');

  // Video Element & Media Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // Available Camera Devices (Handles multi-camera / Windows Hello IR bug)
  const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsVideoPlaying(false);
  }, [stream]);

  // Enumerate all connected cameras
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
        }));

      setVideoDevices(videoInputs);

      // Prefer non-IR camera if available (Windows Hello IR camera often defaults first and shows grey)
      if (videoInputs.length > 0 && !selectedDeviceId) {
        const rgbCamera = videoInputs.find(
          (d) => !d.label.toLowerCase().includes('ir ') && !d.label.toLowerCase().includes('infrared')
        );
        setSelectedDeviceId(rgbCamera ? rgbCamera.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Device enumeration error:', err);
    }
  }, [selectedDeviceId]);

  const startCamera = useCallback(
    async (deviceId?: string, mode?: 'user' | 'environment') => {
      if (activeTab !== 'live' || capturedDataUrl) return;

      try {
        setIsStartingCamera(true);
        setError(null);
        setIsVideoPlaying(false);

        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera streaming is not supported by your browser. Please switch to "Upload Photo".');
        }

        let mediaStream: MediaStream | null = null;

        // Strategy 1: Target specific device if selected
        if (deviceId) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch (e) {
            console.warn('Exact deviceId failed, falling back:', e);
          }
        }

        // Strategy 2: Target facingMode
        if (!mediaStream) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: mode || facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch (e) {
            console.warn('FacingMode constraint failed, falling back to basic video:', e);
          }
        }

        // Strategy 3: Pure basic fallback
        if (!mediaStream) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        setStream(mediaStream);
        await refreshDevices();
      } catch (err: any) {
        console.warn('Camera stream failed:', err);
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera access denied by browser permissions.'
            : 'Camera could not be accessed. Another app might be using it, or the privacy shutter may be closed.'
        );
      } finally {
        setIsStartingCamera(false);
      }
    },
    [activeTab, capturedDataUrl, stream, facingMode, refreshDevices]
  );

  useEffect(() => {
    if (activeTab === 'live' && !capturedDataUrl) {
      startCamera(selectedDeviceId, facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [activeTab, capturedDataUrl, selectedDeviceId, facingMode]);

  // Video DOM attachment & Autoplay Policy handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');

    const handlePlaying = () => {
      setIsVideoPlaying(true);
    };

    const handleLoadedMetadata = () => {
      video.play().then(() => {
        setIsVideoPlaying(true);
      }).catch((playErr) => {
        console.warn('Video play was blocked by browser policy:', playErr);
        setIsVideoPlaying(false);
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('playing', handlePlaying);

    video.play().then(() => {
      setIsVideoPlaying(true);
    }).catch(() => {
      setIsVideoPlaying(false);
    });

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [stream]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setIsVideoPlaying(true);
      }).catch((e) => console.warn('Manual play failed:', e));
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const finalizePhoto = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    // Watermark
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `VERIFIED ATTENDANCE • ${new Date().toLocaleTimeString()} • ${new Date().toLocaleDateString()}`,
      14,
      canvas.height - 13
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          onCapture(blob, dataUrl);
          stopCamera();
        }
      },
      'image/jpeg',
      0.88
    );
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Direct ImageCapture grabFrame fallback if video width is 0
    if (video.videoWidth === 0 && stream && 'ImageCapture' in window) {
      try {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const imageCapture = new (window as any).ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          ctx.drawImage(bitmap, 0, 0);
          finalizePhoto(canvas, ctx);
          return;
        }
      } catch (err) {
        console.warn('ImageCapture fallback error:', err);
      }
    }

    // Mirror image for front camera selfie
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    finalizePhoto(canvas, ctx);
  };

  // Device file / camera app upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onCapture(file, dataUrl);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  // Instant Demo Snapshot
  const handleSimulatedPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 480, 480);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 480, 480);

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(240, 180, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(240, 400, 140, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(320, 220, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓', 320, 228);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VERIFIED ATTENDANCE SELFIE', 240, 420);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 240, 444);

      canvas.toBlob((blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          onCapture(blob, dataUrl);
          stopCamera();
        }
      }, 'image/jpeg');
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* CAPTURE MODE TABS */}
      {!capturedDataUrl && (
        <div className="flex items-center justify-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-md mx-auto border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'live'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            Live Webcam
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            Upload Photo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('demo')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'demo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Demo Snapshot
          </button>
        </div>
      )}

      {/* CAMERA SELECTOR BAR (if multiple cameras detected) */}
      {!capturedDataUrl && activeTab === 'live' && videoDevices.length > 1 && (
        <div className="max-w-md mx-auto flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
          <Sliders className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-slate-500 shrink-0 font-medium">Select Camera:</span>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-lg p-1 text-xs text-slate-800 font-medium"
          >
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* VIEWPORT AREA */}
      <div className="relative aspect-4/3 w-full max-w-md mx-auto overflow-hidden rounded-2xl bg-slate-950 border-2 border-slate-700 shadow-inner flex items-center justify-center">
        {capturedDataUrl ? (
          /* PREVIEW OF CAPTURED PHOTO */
          <div className="relative w-full h-full">
            <img
              src={capturedDataUrl}
              alt="Attendance Selfie Preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium shadow-md">
              <CheckCircle className="w-3.5 h-3.5" />
              Selfie Captured
            </div>
          </div>
        ) : activeTab === 'upload' ? (
          /* UPLOAD MODE VIEW */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/60 hover:bg-slate-900/80 cursor-pointer transition-colors border-2 border-dashed border-slate-600 rounded-2xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Click to Upload / Take Selfie</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Opens your device camera directly or select an image from your files
            </p>
          </div>
        ) : activeTab === 'demo' ? (
          /* DEMO SNAPSHOT VIEW */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3">
              <Zap className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Instant Demo Verified Selfie</p>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              Generate a cryptographically stamped test selfie badge without camera hardware
            </p>
            <button
              type="button"
              onClick={handleSimulatedPhoto}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
            >
              Generate Demo Badge
            </button>
          </div>
        ) : (
          /* LIVE CAMERA MODE */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover bg-black ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Viewfinder frame overlay */}
            <div className="absolute inset-8 border-2 border-dashed border-white/50 rounded-full pointer-events-none flex items-center justify-center">
              <span className="text-white/80 text-xs tracking-wider uppercase font-semibold bg-slate-900/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Align Face Inside Frame
              </span>
            </div>

            {/* Live Camera Badge */}
            {isVideoPlaying && (
              <div className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Live Camera
              </div>
            )}

            {/* Camera Switch Button */}
            {stream && (
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer shadow-md"
                title="Switch camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {/* Play Button Overlay if Autoplay was Paused by Browser */}
            {stream && !isVideoPlaying && !isStartingCamera && (
              <div
                onClick={handleManualPlay}
                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-full bg-blue-600 group-hover:bg-blue-500 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <Play className="w-6 h-6 ml-0.5 fill-white text-white" />
                </div>
                <span className="text-xs font-semibold mt-2.5">Click to Start Camera Feed</span>
              </div>
            )}

            {/* Loading Indicator */}
            {isStartingCamera && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white text-xs gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                <span>Connecting to camera hardware...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap justify-center items-center gap-2.5">
        {capturedDataUrl ? (
          <button
            type="button"
            onClick={onRetake}
            className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retake Photo
          </button>
        ) : activeTab === 'live' ? (
          <>
            <button
              type="button"
              onClick={takePhoto}
              disabled={!stream}
              className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs ${
                stream
                  ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Camera className="w-4 h-4" />
              Capture Live Selfie
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image Instead
            </button>
          </>
        ) : activeTab === 'upload' ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Choose Image / Take Photo
          </button>
        ) : null}
      </div>

      {/* TROUBLESHOOTING HELP DRAWER */}
      {!capturedDataUrl && activeTab === 'live' && (
        <div className="max-w-md mx-auto text-center pt-1">
          <button
            type="button"
            onClick={() => setShowTroubleshoot(!showTroubleshoot)}
            className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            {showTroubleshoot ? 'Hide Camera Help' : 'Camera showing grey or black box?'}
          </button>

          {showTroubleshoot && (
            <div className="mt-2 text-left bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                Common reasons for grey/blank camera on Windows:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                <li>
                  <strong>Physical Privacy Shutter:</strong> Many laptops (Lenovo, HP, Asus, Dell) have a physical slider switch right above the webcam lens. Slide it open to reveal the camera lens.
                </li>
                <li>
                  <strong>Windows Privacy Settings:</strong> Press <kbd className="px-1 bg-white border rounded">Win</kbd> key, search <em>"Camera privacy settings"</em>, and make sure <em>"Let apps access your camera"</em> is ON.
                </li>
                <li>
                  <strong>Windows Hello IR Camera:</strong> If your laptop has facial recognition, use the camera dropdown above to switch from <em>IR Camera</em> to <em>Integrated Webcam</em>.
                </li>
                <li>
                  <strong>Camera in use:</strong> Close Zoom, Microsoft Teams, or other apps that might be holding the webcam lock.
                </li>
                <li>
                  <strong>Quick Alternative:</strong> Simply click the <strong>"Upload Photo"</strong> tab above to snap or select a photo directly from your device!
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
