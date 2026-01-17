'use client';
import { useState, useEffect } from 'react';
import { compressImage } from '../utils/compressor';

export default function ControlPanel({ bucketId, onClose }: { bucketId: number, onClose: () => void }) {
    const [formData, setFormData] = useState<any>({
        genetica: '', etapa: 'Vegetativo',
        fecha: '', ph: '', ec: '',
        grow: '', micro: '', bloom: '',
        nota: ''
    });
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        // Hydrate form
        const gen = localStorage.getItem(`balde${bucketId}_genetica`);
        const stage = localStorage.getItem(`balde${bucketId}_etapa`);
        if (gen) setFormData(prev => ({ ...prev, genetica: gen, etapa: stage || 'Vegetativo' }));
        loadHistory();
    }, [bucketId]);

    const loadHistory = () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(`balde${bucketId}_reg_`));
        const recs = keys.sort().map(k => JSON.parse(localStorage.getItem(k) || '{}'));
        setHistory(recs);
    };

    const handleChange = (e: any) => {
        const { id, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [id]: value }));
        // Auto-save settings
        if (id === 'genetica') localStorage.setItem(`balde${bucketId}_genetica`, value);
        if (id === 'etapa') localStorage.setItem(`balde${bucketId}_etapa`, value);
    };

    const handleSave = async (e: any) => {
        e.preventDefault();
        let imgData = null;

        // Check for file
        const fileInput = document.getElementById('fotoSemana') as HTMLInputElement;
        if (fileInput?.files?.[0]) {
            imgData = await compressImage(fileInput.files[0]);
        }

        // Logic evaluation
        const ph = parseFloat(formData.ph);
        let estado = 'ok';
        let msgs = [];
        if (ph < 5.5 || ph > 6.5) { estado = 'at'; msgs.push('pH Check'); }

        const record = {
            id: Date.now(),
            fecha: new Date().toLocaleDateString(),
            ...formData,
            foto: imgData,
            estado,
            msgs
        };

        localStorage.setItem(`balde${bucketId}_reg_${record.id}`, JSON.stringify(record));
        localStorage.setItem(`balde${bucketId}_estado`, estado); // Update current state status

        // Trigger Nexus Integration
        try {
            await fetch('/api/record', {
                method: 'POST',
                body: JSON.stringify({ bucketId, ...record })
            });
        } catch (err) {
            console.error("Nexus Sync Failed", err);
        }

        loadHistory();
        alert('✅ Registro Guardado y Sincronizado');
    };

    return (
        <div className="glass p-6 max-w-2xl mx-auto my-8 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#52b788]">Gestión Balde {bucketId}</h2>
                <button onClick={onClose} className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20">Cerrar</button>
            </div>

            <form onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label>Genética</label>
                        <input id="genetica" value={formData.genetica} onChange={handleChange} placeholder="Ej: Gorilla Glue" />
                    </div>
                    <div>
                        <label>Etapa</label>
                        <select id="etapa" value={formData.etapa} onChange={handleChange}>
                            <option>Germinación</option>
                            <option>Vegetativo</option>
                            <option>Floración</option>
                        </select>
                    </div>
                </div>

                <hr className="border-t border-white/10 my-6" />

                <h3 className="text-lg font-bold mb-4">📝 Nuevo Registro Semanal</h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label>pH</label><input type="number" step="0.1" id="ph" value={formData.ph} onChange={handleChange} /></div>
                    <div><label>EC</label><input type="number" step="0.1" id="ec" value={formData.ec} onChange={handleChange} /></div>
                </div>

                <label>Nutrientes (G/M/B)</label>
                <div className="flex gap-2">
                    <input type="number" id="grow" placeholder="Gro" onChange={handleChange} />
                    <input type="number" id="micro" placeholder="Mic" onChange={handleChange} />
                    <input type="number" id="bloom" placeholder="Blo" onChange={handleChange} />
                </div>

                <label>Foto Semanal</label>
                <input type="file" id="fotoSemana" className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#52b788] file:text-[#0f1f17] hover:file:bg-[#40916c]" />

                <button type="submit" className="btn-primary w-full mt-6">GUARDAR DATOS</button>
            </form>

            <div className="mt-8">
                <h3 className="font-bold mb-4">Historial</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left opacity-80">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="p-2">Fecha</th>
                                <th>pH/EC</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h: any) => (
                                <tr key={h.id} className="border-b border-white/5">
                                    <td className="p-2">{h.fecha}</td>
                                    <td>{h.ph} / {h.ec}</td>
                                    <td>{h.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
