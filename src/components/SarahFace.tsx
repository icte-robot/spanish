import React, { useEffect, useRef, useState } from 'react';

export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'love' | 'sleepy' | 'confused';

interface SarahFaceProps {
  emotion: Emotion;
  isTalking: boolean;
}

const SarahFace: React.FC<SarahFaceProps> = ({ emotion, isTalking }) => {
  const [mouthD, setMouthD] = useState('M 100 220 Q 150 232 200 220');
  const [leftEyebrowD, setLeftEyebrowD] = useState('M 60 80 Q 90 75 120 80');
  const [rightEyebrowD, setRightEyebrowD] = useState('M 180 80 Q 210 75 240 80');
  const [noseD, setNoseD] = useState('M 145 165 Q 150 170 155 165');
  const [leftEyeRY, setLeftEyeRY] = useState(24);
  const [rightEyeRY, setRightEyeRY] = useState(24);
  const [pupilFill, setPupilFill] = useState('black');
  const [blushOpacity, setBlushOpacity] = useState(0);
  const [tearFill, setTearFill] = useState('rgba(100,200,255,0)');
  const [angerOpacity, setAngerOpacity] = useState(0);
  const [teethOpacity, setTeethOpacity] = useState(0);
  const [mouthInnerOpacity, setMouthInnerOpacity] = useState(0);
  const [mouthInnerRx, setMouthInnerRx] = useState(0);
  const [mouthInnerRy, setMouthInnerRy] = useState(0);
  
  const [headTilt, setHeadTilt] = useState(0);
  const [headTranslateX, setHeadTranslateX] = useState(0);
  const [headTranslateY, setHeadTranslateY] = useState(0);

  const [pupilX, setPupilX] = useState(0);
  const [pupilY, setPupilY] = useState(0);
  const [leftLidRy, setLeftLidRy] = useState(0);
  const [rightLidRy, setRightLidRy] = useState(0);

  const [eyebrowTranslateY, setEyebrowTranslateY] = useState(0);
  const [eyeTranslateY, setEyeTranslateY] = useState(0);
  const [noseTranslateY, setNoseTranslateY] = useState(0);

  const emotionsData: Record<Emotion, any> = {
    neutral: {
      mouth: 'M 100 220 Q 150 232 200 220',
      leftEyebrow: 'M 60 80 Q 90 75 120 80',
      rightEyebrow: 'M 180 80 Q 210 75 240 80',
      nose: 'M 145 165 Q 150 170 155 165',
      eyeRY: 24,
      blush: 0,
      tears: 0,
      anger: 0,
      teeth: 0,
      mouthInnerOpacity: 0,
      mouthInnerRx: 0,
      mouthInnerRy: 0,
      tilt: 0
    },
    happy: {
      mouth: 'M 92 212 Q 150 278 208 212',
      leftEyebrow: 'M 60 75 Q 90 66 120 75',
      rightEyebrow: 'M 180 75 Q 210 66 240 75',
      nose: 'M 144 163 Q 150 167 156 163',
      eyeRY: 17,
      blush: 0.48,
      tears: 0,
      anger: 0,
      teeth: 0.92,
      mouthInnerOpacity: 0.25,
      mouthInnerRx: 24,
      mouthInnerRy: 8,
      tilt: -1.5
    },
    sad: {
      mouth: 'M 112 240 Q 150 203 188 240',
      leftEyebrow: 'M 68 72 Q 90 88 120 76',
      rightEyebrow: 'M 180 76 Q 210 88 232 72',
      nose: 'M 146 167 Q 150 171 154 167',
      eyeRY: 15,
      blush: 0,
      tears: 0.78,
      anger: 0,
      teeth: 0,
      mouthInnerOpacity: 0,
      mouthInnerRx: 0,
      mouthInnerRy: 0,
      tilt: 1.5
    },
    angry: {
      mouth: 'M 100 236 Q 150 220 200 236',
      leftEyebrow: 'M 54 91 Q 90 68 126 84',
      rightEyebrow: 'M 174 84 Q 210 68 246 91',
      nose: 'M 143 164 Q 150 169 157 164',
      eyeRY: 14,
      blush: 0,
      tears: 0,
      anger: 1,
      teeth: 0,
      mouthInnerOpacity: 0.08,
      mouthInnerRx: 18,
      mouthInnerRy: 5,
      tilt: 0
    },
    surprised: {
      mouth: 'M 125 215 Q 150 255 175 215 Q 150 255 125 215',
      leftEyebrow: 'M 60 60 Q 90 49 120 60',
      rightEyebrow: 'M 180 60 Q 210 49 240 60',
      nose: 'M 147 162 Q 150 165 153 162',
      eyeRY: 28,
      blush: 0,
      tears: 0,
      anger: 0,
      teeth: 0,
      mouthInnerOpacity: 0.72,
      mouthInnerRx: 12,
      mouthInnerRy: 18,
      tilt: 0
    },
    love: {
      mouth: 'M 95 210 Q 150 272 205 210',
      leftEyebrow: 'M 60 76 Q 90 68 120 76',
      rightEyebrow: 'M 180 76 Q 210 68 240 76',
      nose: 'M 145 164 Q 150 169 155 164',
      eyeRY: 18,
      blush: 0.8,
      tears: 0,
      anger: 0,
      teeth: 0.72,
      mouthInnerOpacity: 0.2,
      mouthInnerRx: 20,
      mouthInnerRy: 6,
      tilt: -2
    },
    sleepy: {
      mouth: 'M 120 225 Q 150 235 180 225',
      leftEyebrow: 'M 60 86 Q 90 91 120 86',
      rightEyebrow: 'M 180 86 Q 210 91 240 86',
      nose: 'M 146 166 Q 150 169 154 166',
      eyeRY: 6,
      blush: 0.2,
      tears: 0,
      anger: 0,
      teeth: 0,
      mouthInnerOpacity: 0,
      mouthInnerRx: 0,
      mouthInnerRy: 0,
      tilt: 2
    },
    confused: {
      mouth: 'M 110 224 Q 138 230 160 221 Q 182 236 190 226',
      leftEyebrow: 'M 60 86 Q 90 68 120 80',
      rightEyebrow: 'M 180 70 Q 210 86 240 76',
      nose: 'M 144 165 Q 150 169 156 164',
      eyeRY: 22,
      blush: 0,
      tears: 0,
      anger: 0,
      teeth: 0,
      mouthInnerOpacity: 0,
      mouthInnerRx: 0,
      mouthInnerRy: 0,
      tilt: -1
    }
  };

  const talkingShapesData: Record<Emotion, any> = {
    neutral: [
      { d: 'M 102 220 Q 150 245 198 220', rx: 18, ry: 12, teeth: 0.8, inner: 0.8 },
      { d: 'M 96 214 Q 150 265 204 214', rx: 25, ry: 18, teeth: 1.0, inner: 1.0 },
      { d: 'M 108 224 Q 150 230 192 224', rx: 12, ry: 4, teeth: 0.2, inner: 0.4 },
      { d: 'M 115 220 Q 150 250 185 220 Q 150 250 115 220', rx: 15, ry: 20, teeth: 0, inner: 1.0 }
    ],
    happy: [
      { d: 'M 92 212 Q 150 285 208 212', rx: 28, ry: 16, teeth: 1.0, inner: 0.9 },
      { d: 'M 96 216 Q 150 270 204 216', rx: 22, ry: 12, teeth: 0.9, inner: 0.7 },
      { d: 'M 88 210 Q 150 295 212 210', rx: 32, ry: 22, teeth: 1.0, inner: 1.0 },
      { d: 'M 110 215 Q 150 260 190 215 Q 150 260 110 215', rx: 20, ry: 20, teeth: 0.5, inner: 1.0 }
    ],
    sad: [
      { d: 'M 112 238 Q 150 212 188 238', rx: 12, ry: 8, teeth: 0.2, inner: 0.6 },
      { d: 'M 108 234 Q 150 220 192 234', rx: 15, ry: 12, teeth: 0.4, inner: 0.8 },
      { d: 'M 114 240 Q 150 208 186 240', rx: 10, ry: 5, teeth: 0, inner: 0.4 }
    ],
    angry: [
      { d: 'M 102 236 Q 150 224 198 236', rx: 18, ry: 10, teeth: 0.8, inner: 0.8 },
      { d: 'M 98 232 Q 150 248 202 232', rx: 24, ry: 16, teeth: 1.0, inner: 1.0 },
      { d: 'M 104 236 Q 150 220 196 236', rx: 14, ry: 6, teeth: 0.5, inner: 0.5 }
    ],
    surprised: [
      { d: 'M 132 214 Q 150 255 168 214 Q 150 255 132 214', rx: 14, ry: 22, teeth: 0.2, inner: 1.0 },
      { d: 'M 126 212 Q 150 270 174 212 Q 150 270 126 212', rx: 18, ry: 28, teeth: 0.4, inner: 1.0 },
      { d: 'M 129 214 Q 150 240 171 214 Q 150 240 129 214', rx: 12, ry: 15, teeth: 0, inner: 0.8 }
    ],
    love: [
      { d: 'M 96 212 Q 150 275 204 212', rx: 24, ry: 14, teeth: 0.9, inner: 0.8 },
      { d: 'M 92 210 Q 150 285 208 210', rx: 28, ry: 18, teeth: 1.0, inner: 1.0 },
      { d: 'M 98 214 Q 150 260 202 214', rx: 20, ry: 10, teeth: 0.8, inner: 0.6 }
    ],
    sleepy: [
      { d: 'M 120 225 Q 150 242 180 225', rx: 12, ry: 8, teeth: 0.2, inner: 0.6 },
      { d: 'M 116 224 Q 150 248 184 224', rx: 15, ry: 12, teeth: 0.4, inner: 0.8 },
      { d: 'M 122 226 Q 150 236 178 226', rx: 10, ry: 5, teeth: 0, inner: 0.4 }
    ],
    confused: [
      { d: 'M 110 224 Q 140 235 160 221 Q 182 240 190 226', rx: 14, ry: 8, teeth: 0.4, inner: 0.7 },
      { d: 'M 106 222 Q 140 245 162 220 Q 184 250 194 226', rx: 18, ry: 14, teeth: 0.6, inner: 0.9 },
      { d: 'M 112 225 Q 141 230 161 222 Q 181 236 189 225', rx: 10, ry: 5, teeth: 0.2, inner: 0.5 }
    ]
  };

  const baseTiltRef = useRef(0);

  useEffect(() => {
    if (!isTalking) {
      const preset = emotionsData[emotion] || emotionsData.neutral;
      setMouthD(preset.mouth);
      setLeftEyebrowD(preset.leftEyebrow);
      setRightEyebrowD(preset.rightEyebrow);
      setNoseD(preset.nose);
      
      if (emotion === 'confused') {
        setLeftEyeRY(preset.eyeRY * 1.15);
        setRightEyeRY(preset.eyeRY * 0.75);
      } else {
        setLeftEyeRY(preset.eyeRY);
        setRightEyeRY(preset.eyeRY);
      }

      setPupilFill(emotion === 'love' ? '#ff6b9d' : 'black');
      setBlushOpacity(preset.blush);
      setTearFill(`rgba(100,200,255,${preset.tears})`);
      setAngerOpacity(preset.anger);
      setTeethOpacity(preset.teeth);
      setMouthInnerOpacity(preset.mouthInnerOpacity);
      setMouthInnerRx(preset.mouthInnerRx);
      setMouthInnerRy(preset.mouthInnerRy);
      baseTiltRef.current = preset.tilt;
      setHeadTilt(preset.tilt);
      setHeadTranslateX(0);
      setHeadTranslateY(0);
      setEyebrowTranslateY(0);
      setEyeTranslateY(0);
      setNoseTranslateY(0);
    }
  }, [emotion, isTalking]);

  // Talking animation
  useEffect(() => {
    let talkTimer: NodeJS.Timeout;
    let isMounted = true;

    const talkCycle = () => {
      if (!isTalking || !isMounted) return;

      const list = talkingShapesData[emotion] || talkingShapesData.neutral;
      const chosen = list[Math.floor(Math.random() * list.length)];
      
      setMouthD(chosen.d);
      setMouthInnerOpacity(Math.min(1, chosen.inner));
      setMouthInnerRx(chosen.rx);
      setMouthInnerRy(chosen.ry);
      setTeethOpacity(chosen.teeth);

      const bobX = (Math.random() * 2 - 1) * 2;
      const bobY = -2 + Math.random() * 3.5;
      const tilt = baseTiltRef.current + (Math.random() * 2 - 1) * 3;

      setHeadTranslateX(bobX);
      setHeadTranslateY(bobY);
      setHeadTilt(tilt);

      const eyeNarrow = emotion === 'happy' || emotion === 'love' ? 0.85 : 0.95;
      const baseEye = emotionsData[emotion]?.eyeRY || 24;
      setLeftEyeRY(Math.max(3, baseEye * eyeNarrow + (Math.random() * 2 - 1)));
      setRightEyeRY(Math.max(3, baseEye * eyeNarrow + (Math.random() * 2 - 1)));

      setEyebrowTranslateY((Math.random() * 2 - 1) * 2.5);
      setEyeTranslateY((Math.random() * 2 - 1) * 1.5);
      setNoseTranslateY((Math.random() * 2 - 1) * 1.5);

      // Vary the duration between 80ms and 180ms for a more natural speech cadence
      const nextDuration = 80 + Math.random() * 100;
      talkTimer = setTimeout(talkCycle, nextDuration);
    };

    if (isTalking) {
      talkCycle();
    }

    return () => {
      isMounted = false;
      clearTimeout(talkTimer);
    };
  }, [isTalking, emotion]);

  // Breathing animation
  useEffect(() => {
    let breatheRAF: number;
    let t0 = performance.now();

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      const breathe = Math.sin(t * 1.8) * 1.8;
      const sway = Math.sin(t * 0.9) * 1.5;
      const tilt = Math.sin(t * 0.75) * 0.8 + baseTiltRef.current;

      if (!isTalking) {
        setHeadTranslateX(sway);
        setHeadTranslateY(breathe);
        setHeadTilt(tilt);
      }

      breatheRAF = requestAnimationFrame(frame);
    };

    breatheRAF = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(breatheRAF);
  }, [isTalking]);

  // Blinking
  useEffect(() => {
    let blinkTimer: NodeJS.Timeout;
    const blink = (duration = 110) => {
      setLeftLidRy(prev => prev + 1);
      setRightLidRy(prev => prev + 1);
      setTimeout(() => {
        setLeftLidRy(0);
        setRightLidRy(0);
      }, duration);
    };

    const scheduleBlink = () => {
      const next = 1500 + Math.random() * 3500;
      blinkTimer = setTimeout(() => {
        blink(90 + Math.random() * 80);
        if (Math.random() < 0.22) {
          setTimeout(() => blink(70), 120);
        }
        scheduleBlink();
      }, next);
    };

    scheduleBlink();
    return () => clearTimeout(blinkTimer);
  }, []);

  // Saccade
  useEffect(() => {
    let saccadeTimer: NodeJS.Timeout;
    const idleSaccade = () => {
      if (isTalking) return;
      const maxX = 4.5;
      const maxY = 3.2;
      const dx = (Math.random() * 2 - 1) * maxX;
      const dy = (Math.random() * 2 - 1) * maxY;
      setPupilX(dx);
      setPupilY(dy);
    };

    const scheduleSaccade = () => {
      const next = 800 + Math.random() * 1800;
      saccadeTimer = setTimeout(() => {
        idleSaccade();
        scheduleSaccade();
      }, next);
    };

    scheduleSaccade();
    return () => clearTimeout(saccadeTimer);
  }, [isTalking]);

  return (
    <div className="face-container">
      <svg width="320" height="320" viewBox="0 0 300 300" id="face-svg" aria-label="Expressive face">
        <defs>
          <radialGradient id="faceGlow" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
          <radialGradient id="cheekGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(255,160,160,0.8)" />
            <stop offset="100%" stopColor="rgba(255,160,160,0)" />
          </radialGradient>
        </defs>

        <g 
          id="face-shell" 
          className="face-shell" 
          style={{ transform: `translate(${headTranslateX.toFixed(2)}px, ${headTranslateY.toFixed(2)}px) rotate(${headTilt.toFixed(2)}deg)` }}
        >
          <ellipse cx="150" cy="150" rx="120" ry="140" fill="url(#faceGlow)" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>

          {/* eyebrows */}
          <g style={{ transform: `translateY(${eyebrowTranslateY}px)` }} className="facial-feature">
            <path id="left-eyebrow" className="eyebrow" d={leftEyebrowD} fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"/>
            <path id="right-eyebrow" className="eyebrow" d={rightEyebrowD} fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"/>
          </g>

          {/* cheeks */}
          <ellipse id="left-blush" className="cheek" cx="70" cy="165" rx="24" ry="12" fill="url(#cheekGlow)" opacity={blushOpacity}/>
          <ellipse id="right-blush" className="cheek" cx="230" cy="165" rx="24" ry="12" fill="url(#cheekGlow)" opacity={blushOpacity}/>

          {/* left eye */}
          <g id="left-eye-group" style={{ transform: `translateY(${eyeTranslateY}px)` }} className="facial-feature">
            <ellipse id="left-eye-white" className="eye-white" cx="90" cy="110" rx="30" ry={leftEyeRY} fill="white"/>
            <ellipse id="left-eye-lid" className="eyelid" cx="90" cy="110" rx="30" ry={leftLidRy} fill="black"/>
            <circle id="left-pupil" className="pupil" cx={90 + pupilX} cy={110 + pupilY} r="11.5" fill={pupilFill}/>
            <circle id="left-sparkle" className="sparkle" cx={96 + pupilX * 0.6} cy={104 + pupilY * 0.6} r="4.2" fill="white" opacity="0.95"/>
            <circle cx={93 + pupilX * 0.6} cy={107 + pupilY * 0.6} r="1.5" fill="white" opacity="0.7"/>
          </g>

          {/* right eye */}
          <g id="right-eye-group" style={{ transform: `translateY(${eyeTranslateY}px)` }} className="facial-feature">
            <ellipse id="right-eye-white" className="eye-white" cx="210" cy="110" rx="30" ry={rightEyeRY} fill="white"/>
            <ellipse id="right-eye-lid" className="eyelid" cx="210" cy="110" rx="30" ry={rightLidRy} fill="black"/>
            <circle id="right-pupil" className="pupil" cx={210 + pupilX} cy={110 + pupilY} r="11.5" fill={pupilFill}/>
            <circle id="right-sparkle" className="sparkle" cx={216 + pupilX * 0.6} cy={104 + pupilY * 0.6} r="4.2" fill="white" opacity="0.95"/>
            <circle cx={213 + pupilX * 0.6} cy={107 + pupilY * 0.6} r="1.5" fill="white" opacity="0.7"/>
          </g>

          {/* nose */}
          <g style={{ transform: `translateY(${noseTranslateY}px)` }} className="facial-feature">
            <path id="nose" className="nose-path" d={noseD} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <ellipse cx="150" cy="158" rx="5" ry="3" fill="white" opacity="0.25" className="nose-highlight" />
            <ellipse cx="152" cy="157" rx="2" ry="1.5" fill="white" opacity="0.4" className="nose-highlight" />
          </g>

          {/* mouth */}
          <g id="mouth-group">
            <ellipse id="mouth-inner" cx="150" cy="225" rx={mouthInnerRx} ry={mouthInnerRy} fill="#2a0000" opacity={mouthInnerOpacity}/>
            
            <clipPath id="mouth-clip">
              <ellipse cx="150" cy="225" rx={mouthInnerRx} ry={mouthInnerRy} />
            </clipPath>
            
            <ellipse id="tongue" cx="150" cy={225 + mouthInnerRy * 0.6} rx={mouthInnerRx * 0.7} ry={mouthInnerRy * 0.8} fill="#ff6b9d" opacity={mouthInnerOpacity} clipPath="url(#mouth-clip)"/>
            
            <rect id="teeth" x={150 - mouthInnerRx * 0.5} y={225 - mouthInnerRy} width={mouthInnerRx} height={mouthInnerRy * 0.5} rx="2" fill="white" opacity={teethOpacity} clipPath="url(#mouth-clip)"/>

            <path id="mouth" className="mouth-path" d={mouthD} fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
          </g>

          {/* tears */}
          <path id="left-tear" className="tear" d="M 75 140 Q 69 160 75 171 Q 81 160 75 140" fill={tearFill} />
          <path id="right-tear" className="tear" d="M 225 140 Q 219 160 225 171 Q 231 160 225 140" fill={tearFill} />

          {/* anger */}
          <g id="anger-veins" opacity={angerOpacity}>
            <path d="M 250 50 L 260 60 L 255 55 L 265 65" stroke="#ff4444" strokeWidth="2.4" fill="none" />
          </g>
        </g>
      </svg>
      <style>{`
        .face-container {
          filter: drop-shadow(0 0 50px rgba(255,255,255,0.08));
          transition: transform 0.15s ease;
          will-change: transform;
        }

        .face-shell {
          transition: transform 0.2s ease;
          transform-origin: 150px 150px;
        }

        .eye-white,
        .pupil,
        .eyebrow,
        .mouth-path,
        .nose-path,
        .nose-highlight,
        .cheek,
        .tear,
        .eyelid,
        .sparkle,
        .facial-feature,
        #mouth-inner,
        #tongue,
        #teeth {
          transition: all 0.12s cubic-bezier(0.34, 1.2, 0.64, 1);
        }
      `}</style>
    </div>
  );
};

export default SarahFace;
