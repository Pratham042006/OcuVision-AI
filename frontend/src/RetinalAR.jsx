import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Enhanced 3D Retinal Visualization Component
 * Shows an interactive 3D model of retina with heatmap overlay and surface details
 */
function RetinalMesh({ heatmapImage, diseaseInfo }) {
  const meshRef = useRef();
  const textureRef = useRef(null);
  const groupRef = useRef();

  useEffect(() => {
    if (heatmapImage) {
      // Convert base64 image to texture with better processing
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Create gradient background for retinal tissue
        const gradient = ctx.createRadialGradient(512, 512, 100, 512, 512, 800);
        gradient.addColorStop(0, '#2a1a1a');
        gradient.addColorStop(1, '#1a0a0a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Draw heatmap
        ctx.drawImage(img, 150, 150, 724, 724);
        
        // Add vascular network overlay
        ctx.strokeStyle = 'rgba(200, 40, 40, 0.2)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(512, 512, 100 + i * 120, 0, Math.PI * 2);
          ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = texture;

        if (meshRef.current) {
          meshRef.current.material.map = texture;
          meshRef.current.material.needsUpdate = true;
        }
      };
      img.src = heatmapImage;
    }
  }, [heatmapImage]);

  // Create normal map for surface detail
  useEffect(() => {
    if (meshRef.current && !meshRef.current.material.normalMap) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      // Create bumpy surface texture
      ctx.fillStyle = '#8080ff';
      ctx.fillRect(0, 0, 512, 512);
      
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 15;
        const brightness = 128 + Math.random() * 50;
        
        ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      const normalMap = new THREE.CanvasTexture(canvas);
      meshRef.current.material.normalMap = normalMap;
      meshRef.current.material.normalScale.set(0.8, 0.8);
      meshRef.current.material.needsUpdate = true;
    }
  }, []);

  // Gentle rotation animation with slight wobble
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0008;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner optic disc */}
      <Sphere args={[1.8, 64, 64]} position={[0, 0, 0]} ref={meshRef}>
        <meshPhongMaterial
          map={textureRef.current}
          emissive={new THREE.Color(0x1a1a1a)}
          emissiveIntensity={0.4}
          shininess={80}
          wireframe={false}
          side={THREE.DoubleSide}
        />
      </Sphere>
      
      {/* Specular highlights for wet appearance */}
      <Sphere args={[1.8, 32, 32]} position={[0, 0, 0.05]}>
        <meshPhongMaterial
          color={new THREE.Color(0xffffff)}
          emissive={new THREE.Color(0x444444)}
          shininess={100}
          transparent={true}
          opacity={0.15}
          wireframe={false}
          side={THREE.DoubleSide}
        />
      </Sphere>

      {/* Blood vessel visualization layer */}
      <Sphere args={[1.75, 48, 48]} position={[0, 0, -0.1]}>
        <meshPhongMaterial
          color={new THREE.Color(0xaa3333)}
          emissive={new THREE.Color(0x552222)}
          emissiveIntensity={0.3}
          transparent={true}
          opacity={0.15}
          wireframe={false}
          side={THREE.DoubleSide}
        />
      </Sphere>
    </group>
  );
}

function RetinalARViewer({ heatmapImage, diseaseInfo }) {
  return (
    <div className="ar-viewer-container">
      <div className="ar-canvas-wrapper">
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 50 }}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Advanced lighting setup */}
          <ambientLight intensity={0.6} color={0xffffff} />
          
          {/* Main light source */}
          <pointLight 
            position={[8, 8, 8]} 
            intensity={1.2} 
            color={0xffffff}
            distance={30}
          />
          
          {/* Secondary fill light from opposite side */}
          <pointLight 
            position={[-8, -4, 6]} 
            intensity={0.5} 
            color={0x4a90e2}
            distance={30}
          />
          
          {/* Rim light for definition */}
          <pointLight 
            position={[0, 0, -10]} 
            intensity={0.3} 
            color={0xff6b6b}
            distance={20}
          />

          <RetinalMesh heatmapImage={heatmapImage} diseaseInfo={diseaseInfo} />

          <OrbitControls
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            autoRotate={true}
            autoRotateSpeed={1.5}
            minDistance={2}
            maxDistance={12}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
          />
        </Canvas>
      </div>

      <div className="ar-info-panel">
        <div className="ar-info-header">
          <h3>🔬 3D Retinal Digital Twin</h3>
          <p className="ar-subtitle">Interactive Analysis Model</p>
        </div>
        <div className="ar-info-body">
          <div className="info-item">
            <span className="info-label">Disease:</span>
            <span className="info-value">{diseaseInfo?.disease || 'N/A'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Severity:</span>
            <span className={`severity-tag severity-${(diseaseInfo?.severity || 'Medium').toLowerCase()}`}>
              {diseaseInfo?.severity || 'N/A'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Confidence:</span>
            <span className="confidence-bar">
              <div className="confidence-fill" style={{width: diseaseInfo?.confidence || '0%'}}></div>
            </span>
            <span className="confidence-text">{diseaseInfo?.confidence || 'N/A'}</span>
          </div>

          <div className="ar-divider"></div>

          <p className="ar-info-text">
            ✨ <em>Rotate the model to explore affected retinal regions. The heatmap overlay shows disease concentration and severity mapping across the inner retinal surface.</em>
          </p>

          <div className="ar-features">
            <h4>📊 Visualization Features:</h4>
            <ul>
              <li>✓ Heatmap overlay on retinal surface</li>
              <li>✓ Vascular network visualization</li>
              <li>✓ Optic disc illumination</li>
              <li>✓ Multi-layer depth rendering</li>
            </ul>
          </div>

          <div className="ar-controls">
            <h4>🖱️ Interaction Controls:</h4>
            <ul>
              <li>Rotate: Drag mouse</li>
              <li>Zoom: Scroll wheel</li>
              <li>Pan: Right-click + Drag</li>
              <li>Auto: Continuous rotation</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ar-viewer-container {
          display: flex;
          gap: 20px;
          height: 100%;
          padding: 20px;
          background: linear-gradient(135deg, #0f1c3f 0%, #1a3a52 100%);
          border-radius: 12px;
        }

        .ar-canvas-wrapper {
          flex: 1;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 
            0 8px 32px rgba(42, 82, 152, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(74, 144, 226, 0.3);
          min-height: 500px;
          background: radial-gradient(circle at 30% 30%, rgba(42, 82, 152, 0.2), transparent);
        }

        .ar-info-panel {
          width: 300px;
          background: rgba(26, 58, 82, 0.8);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-height: 550px;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(42, 82, 152, 0.2);
        }

        .ar-info-panel::-webkit-scrollbar {
          width: 6px;
        }

        .ar-info-panel::-webkit-scrollbar-track {
          background: rgba(74, 144, 226, 0.1);
          border-radius: 3px;
        }

        .ar-info-panel::-webkit-scrollbar-thumb {
          background: #4a90e2;
          border-radius: 3px;
        }

        .ar-info-panel::-webkit-scrollbar-thumb:hover {
          background: #6ba3f5;
        }

        .ar-info-header {
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(74, 144, 226, 0.3);
        }

        .ar-info-header h3 {
          color: #e0e8f0;
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .ar-subtitle {
          color: #7a8aaa;
          font-size: 12px;
          margin: 0;
          font-style: italic;
        }

        .ar-info-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .info-label {
          color: #4a90e2;
          font-weight: 600;
          min-width: 80px;
        }

        .info-value {
          color: #c0d0e0;
          flex: 1;
        }

        .severity-tag {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .severity-tag.severity-low {
          background: rgba(76, 175, 80, 0.3);
          color: #a3d977;
          border: 1px solid #4caf50;
        }

        .severity-tag.severity-medium {
          background: rgba(255, 152, 0, 0.3);
          color: #ffb366;
          border: 1px solid #ff9800;
        }

        .severity-tag.severity-high {
          background: rgba(255, 87, 34, 0.3);
          color: #ff9966;
          border: 1px solid #ff5722;
        }

        .severity-tag.severity-critical {
          background: rgba(244, 67, 54, 0.3);
          color: #ff6666;
          border: 1px solid #f44336;
        }

        .confidence-bar {
          flex: 1;
          height: 6px;
          background: rgba(74, 144, 226, 0.2);
          border-radius: 3px;
          overflow: hidden;
          display: inline-block;
          vertical-align: middle;
          margin: 0 4px;
        }

        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, #4a90e2, #6ba3f5);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .confidence-text {
          color: #b0b8c8;
          font-size: 12px;
          min-width: 40px;
          text-align: right;
        }

        .ar-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(74, 144, 226, 0.3), transparent);
          margin: 8px 0;
        }

        .ar-info-text {
          padding: 12px;
          background: rgba(42, 82, 152, 0.3);
          border-left: 3px solid #4a90e2;
          border-radius: 6px;
          font-size: 12px;
          color: #c0d0e0;
          margin: 0;
          line-height: 1.5;
        }

        .ar-features, .ar-controls {
          background: rgba(42, 82, 152, 0.2);
          border-radius: 6px;
          padding: 10px;
        }

        .ar-features h4, .ar-controls h4 {
          color: #4a90e2;
          font-weight: 600;
          font-size: 12px;
          margin: 0 0 8px 0;
        }

        .ar-features ul, .ar-controls ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .ar-features li, .ar-controls li {
          color: #a0b0c0;
          font-size: 11px;
          padding: 3px 0;
          line-height: 1.4;
        }

        @media (max-width: 1024px) {
          .ar-viewer-container {
            flex-direction: column;
          }

          .ar-info-panel {
            width: 100%;
            max-height: 250px;
          }

          .ar-canvas-wrapper {
            min-height: 400px;
          }
        }

        @media (max-width: 768px) {
          .ar-viewer-container {
            padding: 12px;
            gap: 12px;
          }

          .ar-canvas-wrapper {
            min-height: 300px;
            border-radius: 8px;
          }

          .ar-info-panel {
            width: 100%;
            max-height: 200px;
            padding: 12px;
            border-radius: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default RetinalARViewer;
