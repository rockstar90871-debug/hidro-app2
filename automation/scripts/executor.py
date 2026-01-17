import os
import sys
import subprocess
import argparse
import json
import csv
import logging
import sqlite3
from datetime import datetime

# Google Drive Imports
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    GDRIVE_AVAILABLE = True
except ImportError:
    GDRIVE_AVAILABLE = False

STATE_FILE = "execution_state.json"
DB_FILE = "data.db"
LOG_FILE = "execution.log"

def setup_logging(target_dir):
    """Configura el sistema de logging."""
    log_path = os.path.join(target_dir, LOG_FILE)
    logging.basicConfig(
        filename=log_path,
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    # También mostrar en consola
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(message)s')
    console.setFormatter(formatter)
    logging.getLogger('').addHandler(console)

def init_db(target_dir):
    """Inicializa la base de datos SQLite."""
    db_path = os.path.join(target_dir, DB_FILE)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS execution_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            script_name TEXT,
            status TEXT,
            timestamp DATETIME,
            output_dir TEXT
        )
    ''')
    conn.commit()
    return conn

def log_to_db(conn, script_name, status, output_dir):
    """Registra una ejecución en la base de datos."""
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO execution_history (script_name, status, timestamp, output_dir)
        VALUES (?, ?, ?, ?)
    ''', (script_name, status, datetime.now(), output_dir))
    conn.commit()

def ensure_output_dirs(target_dir):
    """Crea la estructura de carpetas para outputs."""
    date_str = datetime.now().strftime("%Y-%m-%d")
    output_dir = os.path.join(target_dir, "output", date_str)
    os.makedirs(output_dir, exist_ok=True)
    return output_dir

def get_gdrive_service():
    """Autentica y retorna el servicio de Google Drive."""
    if not GDRIVE_AVAILABLE:
        logging.warning("Librerías de Google Drive no instaladas. Saltando subida.")
        return None

    creds_json = os.environ.get("GDRIVE_CREDENTIALS_JSON")
    if not creds_json:
        logging.warning("Variable GDRIVE_CREDENTIALS_JSON no configurada. Saltando subida.")
        return None

    try:
        creds_dict = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict, scopes=['https://www.googleapis.com/auth/drive']
        )
        return build('drive', 'v3', credentials=creds)
    except Exception as e:
        logging.error(f"Error autenticando con Google Drive: {e}")
        return None

def upload_to_drive(file_path, folder_id):
    """Sube o actualiza un archivo en Google Drive."""
    service = get_gdrive_service()
    if not service or not folder_id:
        return

    filename = os.path.basename(file_path)
    try:
        # 1. Buscar si ya existe
        query = f"name = '{filename}' and '{folder_id}' in parents and trashed = false"
        results = service.files().list(q=query, fields="files(id, name)").execute()
        files = results.get('files', [])

        media = MediaFileUpload(file_path, resumable=True)

        if files:
            # Actualizar existente
            file_id = files[0]['id']
            logging.info(f"Actualizando archivo en Drive: {filename} (ID: {file_id})")
            service.files().update(
                fileId=file_id,
                media_body=media
            ).execute()
        else:
            # Crear nuevo
            file_metadata = {
                'name': filename,
                'parents': [folder_id]
            }
            logging.info(f"Subiendo nuevo archivo a Drive: {filename}")
            service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
    except Exception as e:
        logging.error(f"Error subiendo {filename} a Google Drive: {e}")

def save_results(data, output_dir, base_filename):
    """Guarda datos en JSON y CSV y los sube a Drive."""
    generated_files = []
    
    # Guardar JSON
    json_filename = f"{base_filename}.json"
    json_path = os.path.join(output_dir, json_filename)
    try:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        logging.info(f"Guardado JSON: {json_path}")
        generated_files.append(json_path)
    except Exception as e:
        logging.error(f"Error guardando JSON {base_filename}: {e}")

    # Guardar CSV (asumiendo lista de diccionarios plana)
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        csv_filename = f"{base_filename}.csv"
        csv_path = os.path.join(output_dir, csv_filename)
        try:
            keys = data[0].keys()
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(data)
            logging.info(f"Guardado CSV: {csv_path}")
            generated_files.append(csv_path)
        except Exception as e:
            logging.error(f"Error guardando CSV {base_filename}: {e}")

    # Subir a Google Drive
    folder_id = os.environ.get("GDRIVE_FOLDER_ID", "1gKR4lhHBEH6iaXesiAgxbwuoC8i-wkSr")
    if folder_id:
        for fpath in generated_files:
            upload_to_drive(fpath, folder_id)

def load_state(target_dir):
    """Carga el estado de ejecución desde un archivo JSON."""
    state_path = os.path.join(target_dir, STATE_FILE)
    if os.path.exists(state_path):
        try:
            with open(state_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Error al cargar estado: {e}")
            return {"executed": []}
    return {"executed": []}

def save_state(target_dir, state):
    """Guarda el estado actual en el archivo JSON."""
    state_path = os.path.join(target_dir, STATE_FILE)
    try:
        with open(state_path, 'w') as f:
            json.dump(state, f, indent=4)
    except Exception as e:
        logging.error(f"Error al guardar estado: {e}")

def run_command(command, cwd):
    """Ejecuta un comando en un directorio específico."""
    try:
        logging.info(f"Ejecutando: {' '.join(command)} en {cwd}")
        result = subprocess.run(
            command,
            cwd=cwd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        # Podríamos capturar la salida de los scripts si fuera estructurada (JSON string)
        # Por ahora solo logueamos que terminó ok
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        logging.error(f"Error al ejecutar {' '.join(command)}")
        logging.error(f"STDOUT: {e.stdout}")
        logging.error(f"STDERR: {e.stderr}")
        return False, e.stderr
    except Exception as e:
        logging.error(f"Error inesperado: {str(e)}")
        return False, str(e)

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

    setup_logging(target_dir)
    logging.info("--- Nueva Ejecución Iniciada ---")
    
    conn = init_db(target_dir)
    output_dir = ensure_output_dirs(target_dir)

    # Gestión del estado
    if args.reset:
        logging.info("Reiniciando estado de ejecución.")
        state = {"executed": []}
        save_state(target_dir, state)
    else:
        state = load_state(target_dir)

    executed_set = set(state.get("executed", []))
    logging.info(f"Iniciando ejecución en: {target_dir}")
    logging.info(f"Scripts previamente ejecutados: {len(executed_set)}")

    # Recorrer el árbol de directorios
    for root, dirs, files in os.walk(target_dir, topdown=True):
        # Ignorar carpeta output y git
        dirs[:] = [d for d in dirs if d not in ['output', '.git', '.github', 'node_modules']]
        dirs.sort()
        
        # Orden personalizado: Configs primero, luego alfabético
        files.sort(key=lambda f: (get_priority(f), f))

        for filename in files:
            file_path = os.path.join(root, filename)
            rel_path = os.path.relpath(file_path, target_dir)
            
            # 1. Verificar si ya se ejecutó
            if rel_path in executed_set:
                logging.info(f"[SKIP] Ya ejecutado: {filename}")
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
                logging.info(f"--- Procesando: {file_path} ---")
                success, output = run_command(command, cwd=root)
                
                status_db = "SUCCESS" if success else "FAILURE"
                log_to_db(conn, filename, status_db, output_dir)
                
                # Intentar parsear salida como JSON para guardar estructurado (Hook experimental)
                try:
                    # Si el script imprime un JSON válido en la última línea, lo guardamos
                    lines = output.strip().split('\n')
                    if lines:
                        last_line = lines[-1]
                        data = json.loads(last_line)
                        save_results(data, output_dir, f"result_{filename}")
                except:
                    pass # No era JSON, ignorar

                if success:
                    # Guardar estado inmediatamente
                    state["executed"].append(rel_path)
                    save_state(target_dir, state)
                    logging.info(f"Script completado: {filename}")
                else:
                    logging.error(f"Fallo crítico en {filename}. Deteniendo ejecución.")
                    conn.close()
                    sys.exit(1)
            else:
                pass # Ignorar otros archivos
    
    conn.close()
    logging.info("Todos los scripts han sido procesados correctamente.")

if __name__ == "__main__":
    main()
