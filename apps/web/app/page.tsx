'use client';
import { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import BucketGrid from './components/BucketGrid';
import ControlPanel from './components/ControlPanel';

export default function Home() {
    const [showSplash, setShowSplash] = useState(true);
    const [selectedBucket, setSelectedBucket] = useState<number | null>(null);

    useEffect(() => {
        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js');
        }
    }, []);

    return (
        <div className="min-h-screen pb-10">
            {/* Splash Screen Overlay */}
            <SplashScreen onEnter={() => setShowSplash(false)} />

            {/* Main App Content */}
            <main className={`transition-opacity duration-1000 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>
                <header className="text-center p-8">
                    <h1 className="text-3xl font-bold text-[#52b788] mb-2">Sala de Cultivo</h1>
                    <p className="text-sm opacity-60">SmartGrow v2.0 // Nexus Connected</p>
                </header>

                {!selectedBucket ? (
                    <BucketGrid onSelectBucket={setSelectedBucket} />
                ) : (
                    <ControlPanel bucketId={selectedBucket} onClose={() => setSelectedBucket(null)} />
                )}
            </main>
        </div>
    );
}
