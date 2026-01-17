'use client';

interface BucketProps {
    id: number;
    data: any;
    onClick: (id: number) => void;
}

function Bucket({ id, data, onClick }: BucketProps) {
    const statusColors = {
        ok: 'bg-[#2d6a4f]', // Green
        at: 'bg-[#b08900]', // Yellow/Warn
        mal: 'bg-[#9b2226]', // Red
    };

    const statusColor = statusColors[data?.estado as keyof typeof statusColors] || statusColors.ok;
    const bgImage = data?.foto ? `url(${data.foto})` : 'none';

    return (
        <div
            onClick={() => onClick(id)}
            className={`${statusColor} relative rounded-xl h-32 cursor-pointer transition-transform hover:scale-105 shadow-lg overflow-hidden border border-white/10`}
            style={{
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}
        >
            <div className="absolute inset-0 bg-black/40 hover:bg-black/30 transition-colors" />
            <div className="relative z-10 p-3 h-full flex flex-col justify-between">
                <span className="font-bold text-sm bg-black/50 px-2 py-1 rounded inline-block w-fit backdrop-blur-sm">
                    🪣 Balde {id}
                </span>
                {data?.genetica && (
                    <span className="text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm text-gray-200">
                        {data.genetica}
                    </span>
                )}
            </div>
        </div>
    );
}

export default function BucketGrid({ onSelectBucket }: { onSelectBucket: (id: number) => void }) {
    // Helper to read simple status for initial render (in real app, passed via props or context)
    // For now, we render 9 placeholders that will be hydrated by the parent or self-effect
    const buckets = Array.from({ length: 9 }, (_, i) => i + 1);

    return (
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto p-4 animate-fade-in delay-100">
            {buckets.map((id) => {
                // Reading from localStorage in a real component would happen inside useEffect
                // Here we pass basic props, assuming parent handles state or we hydrate client-side
                const storageKey = `balde${id}_genetica`; // Simple check
                return (
                    <Bucket
                        key={id}
                        id={id}
                        data={{ /* Hydrated later */ }}
                        onClick={onSelectBucket}
                    />
                );
            })}
        </div>
    );
}
