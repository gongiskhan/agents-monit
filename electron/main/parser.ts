import * as fs from 'fs';
import * as readline from 'readline';
import { Message, MessageType } from './types';

export async function parseJSONLFile(filePath: string): Promise<Message[]> {
  const messages: Message[] = [];

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      try {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const data = JSON.parse(trimmedLine);

        // Parse Claude Code session message format
        if (data.type && data.content !== undefined) {
          const message: Message = {
            type: parseMessageType(data.type),
            content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
            timestamp: data.timestamp || new Date().toISOString(),
          };
          messages.push(message);
        }
      } catch (error) {
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

function parseMessageType(type: string): MessageType {
  const lowerType = type.toLowerCase();

  if (lowerType === 'user' || lowerType === 'human') {
    return MessageType.User;
  } else if (lowerType === 'assistant' || lowerType === 'ai') {
    return MessageType.Assistant;
  } else if (lowerType === 'system') {
    return MessageType.System;
  }

  return MessageType.System;
}