'use client';
import { useState, useEffect } from 'react';

export default function SplashScreen({ onEnter }: { onEnter: () => void }) {
    const [isVisible, setIsVisible] = useState(true);
    const [isFading, setIsFading] = useState(false);

    const handleEnter = () => {
        setIsFading(true);
        setTimeout(() => {
            setIsVisible(false);
            onEnter();
        }, 500);
    };

    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f1f17] transition-opacity duration-500 ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
            <div className="glass p-10 rounded-3xl text-center animate-fade-in max-w-sm mx-4">
                <div className="text-6xl mb-4">🌱</div>
                <h1 className="text-4xl font-bold mb-2 text-[#52b788]">SmartGrow</h1>
                <p className="text-gray-400 mb-8 tracking-wider uppercase text-xs">Nexus Project Architecture</p>
                <button
                    onClick={handleEnter}
                    className="btn-primary w-full text-lg shadow-[0_0_20px_rgba(82,183,136,0.5)] hover:shadow-[0_0_30px_rgba(82,183,136,0.8)]"
                >
                    ENTRAR AL CULTIVO
                </button>
            </div>
        </div>
    );
}
