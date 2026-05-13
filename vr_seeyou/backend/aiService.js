const axios = require('axios');
const fs = require('fs');
const path = require('path');

function readLooseEnvValue(key) {
  try {
    const envPath = path.join(__dirname, '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    const line = text.split(/\r?\n/).find(item => {
      const normalized = item.trim();
      return normalized.startsWith(`${key}=`) || normalized.startsWith(`${key} =`);
    });
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch (error) {
    return '';
  }
}

function readLooseLabelValue(label) {
  try {
    const envPath = path.join(__dirname, '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    const line = text.split(/\r?\n/).find(item => item.trim().startsWith(label));
    if (!line) return '';
    const trimmed = line.trim();
    const rest = trimmed.slice(label.length).trimStart();
    if (!rest) return '';
    const firstCode = rest.charCodeAt(0);
    if (rest[0] !== ':' && firstCode !== 65306) return '';
    return rest.slice(1).trim().replace(/^['"]|['"]$/g, '');
  } catch (error) {
    return '';
  }
}

function normalizeChatCompletionsEndpoint(value) {
  const endpoint = String(value || '').trim().replace(/\/$/, '');
  if (!endpoint) return 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  if (endpoint.endsWith('/chat/completions')) return endpoint;
  return `${endpoint}/chat/completions`;
}

// 模拟AI识别结果（用于开发和演示，无需申请API）
const MOCK_CATEGORIES = ['上衣', '裤子', '裙子', '外套', '鞋子', '配饰'];
const MOCK_COLORS = ['黑色', '白色', '灰色', '蓝色', '红色', '绿色', '黄色', '粉色', '米色', '棕色'];
const MOCK_SEASONS = ['春/秋', '夏季', '冬季', '四季'];
const MOCK_MATERIALS = ['棉', '涤纶', '羊毛', '牛仔布', '丝绸', '皮革', '混纺'];
const MOCK_STYLES = ['休闲', '商务', '运动', '正式', '街头', '简约'];

// 颜色关键词映射（用于简单颜色识别）
const COLOR_KEYWORDS = {
  '黑': '黑色', '白': '白色', '灰': '灰色', '蓝': '蓝色',
  '红': '红色', '绿': '绿色', '黄': '黄色', '粉': '粉色',
  '米': '米色', '棕': '棕色', '褐': '棕色', '紫': '紫色',
  '橙': '橙色', '青': '青色', '藏': '藏青', '驼': '驼色'
};

// 衣物类型关键词映射
const CATEGORY_KEYWORDS = {
  't恤': '上衣', '衬衫': '上衣', '卫衣': '上衣', '毛衣': '上衣',
  '西装': '外套', '夹克': '外套', '大衣': '外套', '风衣': '外套',
  '羽绒服': '外套', '棉服': '外套',
  '牛仔裤': '裤子', '西裤': '裤子', '休闲裤': '裤子', '短裤': '裤子',
  '连衣裙': '裙子', '半身裙': '裙子', '短裙': '裙子',
  '运动鞋': '鞋子', '皮鞋': '鞋子', '靴子': '鞋子', '凉鞋': '鞋子',
  '包': '配饰', '帽子': '配饰', '围巾': '配饰', '腰带': '配饰'
};

/**
 * 模拟AI识别 - 无需调用外部API
 * 基于文件名和简单启发式规则进行"识别"
 */
async function mockRecognize(imagePath, originalName = '') {
  // 模拟延迟，像真实的AI调用
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // 从文件名提取线索
  const lowerName = originalName.toLowerCase();
  
  // 尝试推断类别
  let category = '上衣'; // 默认
  for (const [keyword, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lowerName.includes(keyword)) {
      category = cat;
      break;
    }
  }
  
  // 尝试推断颜色
  let color = '未知';
  for (const [keyword, col] of Object.entries(COLOR_KEYWORDS)) {
    if (lowerName.includes(keyword)) {
      color = col;
      break;
    }
  }
  if (color === '未知') {
    color = MOCK_COLORS[Math.floor(Math.random() * MOCK_COLORS.length)];
  }
  
  // 生成其他属性
  const season = MOCK_SEASONS[Math.floor(Math.random() * MOCK_SEASONS.length)];
  const material = MOCK_MATERIALS[Math.floor(Math.random() * MOCK_MATERIALS.length)];
  const style = MOCK_STYLES[Math.floor(Math.random() * MOCK_STYLES.length)];
  
  // 生成标签
  const tags = [category, color, season, style].filter(Boolean).join(',');
  
  return {
    name: `${color}${category}`,
    category,
    color,
    season,
    material,
    style,
    tags,
    confidence: 0.7 + Math.random() * 0.25, // 70%-95%置信度
    raw: { mock: true, source: 'local_heuristic' }
  };
}

/**
 * 调用阿里云视觉智能API进行图像识别
 */
async function aliyunRecognize(imagePath) {
  // 这里需要接入阿里云视觉智能API
  // 文档：https://help.aliyun.com/document_detail/155645.html
  
  // 示例代码结构（需要替换为实际实现）：
  /*
  const RPCClient = require('@alicloud/pop-core').RPCClient;
  const client = new RPCClient({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    endpoint: 'https://viapi.cn-shanghai.aliyuncs.com',
    apiVersion: '2023-03-01'
  });
  
  // 先上传图片到OSS获取URL，或直接传Base64
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  
  const result = await client.request('RecognizeImage', {
    ImageURL: `data:image/jpeg;base64,${imageBase64}`
  });
  */
  
  throw new Error('阿里云API需要在 .env 中配置 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET');
}

/**
 * 调用百度AI图像识别API
 */
async function baiduRecognize(imagePath) {
  // 这里需要接入百度AI开放平台
  // 文档：https://ai.baidu.com/ai-doc/IMAGERECOGNITION/
  
  // 示例代码结构：
  /*
  const token = await getBaiduToken();
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  
  const response = await axios.post(
    'https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general',
    qs.stringify({ image: imageBase64 }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      params: { access_token: token }
    }
  );
  */
  
  throw new Error('百度API需要在 .env 中配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
}

/**
 * 调用火山方舟（字节跳动）API进行图像识别
 * 支持多模态大模型，如 Doubao-vision 等
 */
async function volcanoRecognize(imagePath) {
  const apiKey = process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || process.env.API_KEY;
  const endpoint = normalizeChatCompletionsEndpoint(
    process.env.VOLCANO_MODEL_ENDPOINT ||
    process.env.ARK_MODEL_ENDPOINT ||
    readLooseLabelValue('Base URL') ||
    'https://ark.cn-beijing.volces.com/api/v3'
  );
  const modelId =
    process.env.VOLCANO_MODEL_ID ||
    process.env.ARK_MODEL_ID ||
    process.env.MODEL_ID ||
    process.env['Model ID'] ||
    readLooseEnvValue('Model ID') ||
    'doubao-vision-lite-32k-250115';
  
  if (!apiKey) {
    throw new Error('火山方舟API需要在 .env 中配置 VOLCANO_API_KEY（或 API_KEY）');
  }

  try {
    // 读取图片并转为 base64
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    // 火山方舟 OpenAI 兼容接口调用示例
    // 文档：https://www.volcengine.com/docs/82379/1263482
    const response = await axios.post(
      endpoint,
      {
        model: modelId,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: '请只识别图片中最主要、最清晰的衣物，不要把人物皮肤、背景、家具或灯光当作衣物颜色。以严格 JSON 返回：{"name":"简短衣物名","category":"上衣/裤子/裙子/外套/鞋子/配饰","color":"主色，如浅灰色/淡紫色/黑色","season":"春/秋/夏季/冬季/四季","material":"尽量判断，如羽绒/棉/羊毛/牛仔布/皮革/未知","style":"休闲/商务/运动/正式/街头/简约","occasion":"通勤/约会/运动/休闲/正式/旅行","fit":"修身/宽松/标准","tags":"用逗号分隔的补充标签","confidence":0到1之间的小数}。只返回JSON，不要其他文字。'
              }
            ]
          }
        ],
        max_tokens: 1024
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        proxy: false,
        timeout: 60000
      }
    );

    // 解析火山方舟的返回
    const message = response.data.choices?.[0]?.message || {};
    const content = message.content || message.reasoning_content || '';
    
    // 尝试从返回内容中提取JSON
    let parsed = {};
    try {
      // 尝试直接解析
      parsed = JSON.parse(content);
    } catch (e) {
      // 尝试从markdown代码块中提取
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // 尝试提取花括号内容
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        }
      }
    }

    if (!parsed || Object.keys(parsed).length === 0) {
      throw new Error('模型未返回结构化衣物识别结果，请确认当前模型支持图片输入');
    }

    const category = parsed.类别 || parsed.category || '上衣';
    const color = parsed.颜色 || parsed.color || '未知';
    const season = parsed.季节 || parsed.season || '四季';
    const material = parsed.材质 || parsed.material || '未知';
    const style = parsed.风格 || parsed.style || '休闲';
    const occasion = parsed.场合 || parsed.occasion || '休闲';
    const fit = parsed.版型 || parsed.fit || '标准';
    const name = parsed.名称 || parsed.name || `${color}${category}`;
    const tags = parsed.标签 || parsed.tags || [category, color, season, style].filter(Boolean).join(',');
    const confidence = Number(parsed.置信度 || parsed.confidence || 0.85);

    return {
      name,
      category,
      color,
      season,
      material,
      style,
      occasion,
      fit,
      tags,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.85,
      raw: { source: 'volcano_ark', originalResponse: content }
    };

  } catch (error) {
    console.error('火山方舟API调用失败:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
    throw new Error(`火山方舟识别失败: ${error.message}`);
  }
}

/**
 * 主识别函数 - 根据配置选择识别方式
 */
async function recognizeClothing(imagePath, originalName = '') {
  const useMock = process.env.MOCK_AI === 'true';
  
  if (useMock) {
    console.log('🎭 使用模拟AI识别（无需API Key）');
    return await mockRecognize(imagePath, originalName);
  }
  
  // 优先使用阿里云
  if (process.env.ALIYUN_ACCESS_KEY_ID) {
    console.log('🔍 使用阿里云视觉智能识别');
    return await aliyunRecognize(imagePath);
  }
  
  // 其次使用百度
  if (process.env.BAIDU_API_KEY) {
    console.log('🔍 使用百度AI识别');
    return await baiduRecognize(imagePath);
  }

  // 使用火山方舟（字节跳动）
  if (process.env.VOLCANO_API_KEY || process.env.ARK_API_KEY || process.env.API_KEY) {
    console.log('🔍 使用火山方舟AI识别');
    return await volcanoRecognize(imagePath);
  }
  
  // 默认回退到模拟模式
  console.log('⚠️ 未配置AI API，使用模拟识别。请在 .env 中配置API Key，或设置 MOCK_AI=true');
  return await mockRecognize(imagePath, originalName);
}

module.exports = {
  recognizeClothing,
  mockRecognize,
  aliyunRecognize,
  baiduRecognize,
  volcanoRecognize
};
