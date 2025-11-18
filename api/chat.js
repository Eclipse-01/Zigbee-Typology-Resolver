// api/chat.js
export default async function handler(request, response) {
  // 1. 安全检查
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Server configuration error: AI_API_KEY is missing.' });
  }

  try {
    // 2. 获取前端数据
    // 我们直接透传 messages 数组，这样前端设置的 System Prompt 才能生效
    const { messages } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return response.status(400).json({ message: 'Invalid request: messages array is required.' });
    }

    // 3. 调用智谱 AI
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${generateToken(apiKey)}` // 在服务器端生成 Token
      },
      body: JSON.stringify({
        model: 'glm-4.5-flash', // 使用最新的 GLM-4.5 Flash 模型
        messages: messages,
        temperature: 0.1
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`AI API Error: ${resp.status} - ${errorText}`);
    }

    const data = await resp.json();
    
    // 4. 返回结果给前端
    response.status(200).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    response.status(500).json({ message: error.message });
  }
}

// 简单的 JWT 生成器 (运行在 Node.js 环境)
// 注意：Vercel Edge Function 环境中没有 'jsrsasign'，我们使用原生 Buffer 处理
function generateToken(apiKey) {
  try {
    const [id, secret] = apiKey.split('.');
    const now = Date.now();
    const payload = {
      api_key: id,
      exp: now + 3600 * 1000,
      timestamp: now,
    };
    
    // 简单的 Base64Url 编码函数
    const sign = (str) => {
        const crypto = require('crypto');
        return crypto.createHmac('sha256', secret).update(str).digest('base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const header = { alg: 'HS256', sign_type: 'SIGN' };
    const tokenPart = `${b64(header)}.${b64(payload)}`;
    const signature = sign(tokenPart);
    
    return `${tokenPart}.${signature}`;
  } catch (e) {
    console.error("Token generation failed:", e);
    return ""; // 应该抛出异常，但这里为了简单返回空
  }
}
