/**
 * FileHandler - ファイル読み込みと解析を担当
 */
class FileHandler {
    constructor() {
        this.supportedExtensions = ['.csv', '.xlsx', '.xls'];
    }

    /**
     * ファイルを読み込んでデータを解析する
     * @param {File} file - 読み込むファイル
     * @returns {Promise<{headers: string[], data: any[][]}>}
     */
    async readFile(file) {
        const extension = this.getFileExtension(file.name);
        
        if (!this.supportedExtensions.includes(extension)) {
            throw new Error(`Unsupported file format: ${extension}`);
        }

        if (extension === '.csv') {
            return await this.readCSV(file);
        } else {
            return await this.readExcel(file);
        }
    }

    /**
     * ファイル拡張子を取得
     * @param {string} filename 
     * @returns {string}
     */
    getFileExtension(filename) {
        return filename.slice(filename.lastIndexOf('.')).toLowerCase();
    }

    /**
     * CSVファイルを読み込む
     * @param {File} file 
     * @returns {Promise<{headers: string[], data: any[][]}>}
     */
    async readCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const result = this.parseCSV(text);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * CSVテキストを解析
     * @param {string} text 
     * @returns {{headers: string[], data: any[][]}}
     */
    parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) {
            throw new Error('Empty CSV file');
        }

        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCSVLine(lines[i]);
            if (row.length > 0) {
                data.push(row);
            }
        }

        return { headers, data };
    }

    /**
     * CSV行を解析（ダブルクォート対応）
     * @param {string} line 
     * @returns {string[]}
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    current += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    current += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
        }
        result.push(current.trim());

        return result;
    }

    /**
     * Excelファイルを読み込む
     * @param {File} file 
     * @returns {Promise<{headers: string[], data: any[][]}>}
     */
    async readExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 最初のシートを読み込む
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // シートをJSON配列に変換
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length === 0) {
                        throw new Error('Empty Excel file');
                    }

                    const headers = jsonData[0].map(h => String(h || ''));
                    const rows = jsonData.slice(1).map(row => 
                        row.map(cell => cell !== undefined ? String(cell) : '')
                    );

                    resolve({ headers, data: rows });
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read Excel file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 値をDataTypeに従って変換
     * @param {string} value - 変換する値
     * @param {string} dataType - データ型
     * @param {string} delimiter - 配列の区切り文字
     * @returns {any}
     */
    convertValue(value, dataType, delimiter = '|') {
        if (value === '' || value === null || value === undefined) {
            return null;
        }

        switch (dataType) {
            case 'string':
                return String(value);
            
            case 'number':
                const intVal = parseInt(value, 10);
                return isNaN(intVal) ? null : intVal;
            
            case 'float':
                const floatVal = parseFloat(value);
                return isNaN(floatVal) ? null : floatVal;
            
            case 'boolean':
                const lower = String(value).toLowerCase();
                if (lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1') {
                    return true;
                } else if (lower === 'n' || lower === 'no' || lower === 'false' || lower === '0') {
                    return false;
                }
                return null;
            
            case 'string[]':
                return String(value).split(delimiter)
                    .map(s => s.trim())
                    .filter(s => s !== '');  // 空文字列を除外
            
            case 'number[]':
                return String(value).split(delimiter)
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => !isNaN(n));
            
            case 'float[]':
                return String(value).split(delimiter)
                    .map(s => parseFloat(s.trim()))
                    .filter(n => !isNaN(n));
            
            case 'boolean[]':
                return String(value).split(delimiter).map(s => {
                    const lower = s.trim().toLowerCase();
                    if (lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1') {
                        return true;
                    } else if (lower === 'n' || lower === 'no' || lower === 'false' || lower === '0') {
                        return false;
                    }
                    return null;
                }).filter(b => b !== null);
            
            default:
                return String(value);
        }
    }
}

// グローバルインスタンス
const fileHandler = new FileHandler();
