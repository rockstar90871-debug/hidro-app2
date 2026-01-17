import os
import sys
import subprocess
import argparse
import json
from datetime import datetime

STATE_FILE = "execution_state.json"

def load_state(target_dir):
    """Carga el estado de ejecución desde un archivo JSON."""
    state_path = os.path.join(target_dir, STATE_FILE)
    if os.path.exists(state_path):
        try:
            with open(state_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Error al cargar estado: {e}")
            return {"executed": []}
    return {"executed": []}

def save_state(target_dir, state):
    """Guarda el estado actual en el archivo JSON."""
    state_path = os.path.join(target_dir, STATE_FILE)
    try:
        with open(state_path, 'w') as f:
            json.dump(state, f, indent=4)
    except Exception as e:
        print(f"[!] Error al guardar estado: {e}")

def run_command(command, cwd):
    """Ejecuta un comando en un directorio específico."""
    try:
        print(f"[*] Ejecutando: {' '.join(command)} en {cwd}")
        result = subprocess.run(
            command,
            cwd=cwd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[!] Error al ejecutar {' '.join(command)}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False
    except Exception as e:
        print(f"[!] Error inesperado: {str(e)}")
        return False

def get_priority(filename):
    """Asigna prioridad: 0 para archivos de config/setup, 1 para el resto."""
    lower = filename.lower()
    if "config" in lower or "setup" in lower or "install" in lower or "env" in lower:
        return 0
    return 1

def main():
    parser = argparse.ArgumentParser(description="Ejecutor secuencial de scripts con persistencia.")
    parser.add_argument("directory", help="Directorio raíz a escanear")
    parser.add_argument("--reset", action="store_true", help="Reiniciar estado de ejecución")
    args = parser.parse_args()

    target_dir = os.path.abspath(args.directory)

    if not os.path.isdir(target_dir):
        print(f"[!] El directorio {target_dir} no existe.")
        sys.exit(1)

    # Gestión del estado
    if args.reset:
        print("[*] Reiniciando estado de ejecución.")
        state = {"executed": []}
        save_state(target_dir, state)
    else:
        state = load_state(target_dir)

    executed_set = set(state.get("executed", []))
    print(f"[*] Iniciando ejecución en: {target_dir}")
    print(f"[*] Scripts previamente ejecutados: {len(executed_set)}")

    # Recorrer el árbol de directorios
    for root, dirs, files in os.walk(target_dir, topdown=True):
        dirs.sort()
        
        # Orden personalizado: Configs primero, luego alfabético
        files.sort(key=lambda f: (get_priority(f), f))

        for filename in files:
            file_path = os.path.join(root, filename)
            rel_path = os.path.relpath(file_path, target_dir)
            
            # 1. Verificar si ya se ejecutó
            if rel_path in executed_set:
                print(f"[SKIP] Ya ejecutado: {filename}")
                continue
            
            # 2. Definir comando
            command = None
            if filename == "executor.py": # Evitar auto-ejecución recursiva
                continue

            if filename.endswith(".py"):
                command = [sys.executable, filename]
            elif filename.endswith(".sh"):
                command = ["bash", filename]
            
            # 3. Ejecutar
            if command:
                print(f"--- Procesando: {file_path} ---")
                success = run_command(command, cwd=root)
                
                if success:
                    # Guardar estado inmediatamente
                    state["executed"].append(rel_path)
                    save_state(target_dir, state)
                else:
                    print(f"[!] Fallo crítico en {filename}. Deteniendo ejecución.")
                    sys.exit(1)
            else:
                pass # Ignorar otros archivos

    print("[*] Todos los scripts han sido procesados correctamente.")

if __name__ == "__main__":
    main()
