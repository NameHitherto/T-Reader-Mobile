/**
 * 书籍配置文件
 */
export interface Book {
    id: string;
    title: string;
    cover: string;
    path: string;
    added: string;
    author: string;
    lastRead: string;
    size: string;
    language: string;
    location: string;
}

/**
 * 核心配置文件
 */
export interface Setting {
    WEBDAV_BASE_URL?: string;
    WEBDAV_FOLDER?: string;
    WEBDAV_USER?: string;
    WEBDAV_PASS?: string;
    MODEL_NAME?: string;
    MODEL_BASE_URL?: string;
    MODEL_API_KEY?: string;
}

/**
 * 大模型单次对话
 */
export interface ModelMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * 大模型API调用参数
 */
export interface ModelRequestOptions {
    messages: ModelMessage[]; // 对话内容
    stream?: boolean; // 是否流式输出
    bookInfo?: string; // 书籍信息
    temperature?: number; // 随机度
    maxTokens?: number; // 最大生成长度
    onUpdate?: (chunk: string) => void; // 内容更新回调
    onComplete?: (fullResponse: string) => void; // 完成回调
    onError?: (error: any) => void; // 错误回调
}