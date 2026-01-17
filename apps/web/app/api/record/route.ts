import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('[Nexus API] Received Record:', body);

        // Path to the script relative to the running Next.js server (this might need adjustment depending on deployment, 
        // but for local dev this points to the tools/scripts in the monorepo root)
        const scriptPath = path.resolve(process.cwd(), '../../tools/scripts/generate-eng-note.ts');

        // Execute the note generation script
        // We pass the data strictly as an env var or just trigger the generic note for now as per the "Boilerplate" scope
        // In a real scenario, we'd pass args to the script.
        exec(`npx ts-node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Nexus API] Error generating note: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`[Nexus API] Script stderr: ${stderr}`);
                return;
            }
            console.log(`[Nexus API] Note Generated: ${stdout}`);
        });

        return NextResponse.json({ success: true, message: 'Nexus Sync Triggered' });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to process' }, { status: 500 });
    }
}
