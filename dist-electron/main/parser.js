"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJSONLFile = parseJSONLFile;
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const types_1 = require("./types");
async function parseJSONLFile(filePath) {
    const messages = [];
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });
        rl.on('line', (line) => {
            try {
                const trimmedLine = line.trim();
                if (!trimmedLine)
                    return;
                const data = JSON.parse(trimmedLine);
                // Parse Claude Code session message format
                if (data.type && data.content !== undefined) {
                    const message = {
                        type: parseMessageType(data.type),
                        content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
                        timestamp: data.timestamp || new Date().toISOString(),
                    };
                    messages.push(message);
                }
            }
            catch (error) {
                // Skip invalid JSON lines
                console.warn(`Skipping invalid JSON line: ${line.substring(0, 100)}...`);
            }
        });
        rl.on('close', () => {
            resolve(messages);
        });
        rl.on('error', (error) => {
            reject(error);
        });
    });
}
function parseMessageType(type) {
    const lowerType = type.toLowerCase();
    if (lowerType === 'user' || lowerType === 'human') {
        return types_1.MessageType.User;
    }
    else if (lowerType === 'assistant' || lowerType === 'ai') {
        return types_1.MessageType.Assistant;
    }
    else if (lowerType === 'system') {
        return types_1.MessageType.System;
    }
    return types_1.MessageType.System;
}
//# sourceMappingURL=parser.js.map