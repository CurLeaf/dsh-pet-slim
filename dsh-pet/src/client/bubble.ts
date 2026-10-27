/**
 * 浏览器半侧的碎碎念气泡：哑组件，只把 shared 的行数据映射成 React 节点。
 * 不发起请求，显隐与停留时长由 pet.ts 控制。
 * 依赖运行时注入的 react 与 shared 的 whisper 视图。
 * 必须始终成立：样式与桌面端同源，文案与档位由 shared 计算。
 * @module dsh-pet/src/client/bubble
 */
import {
  MEME_BUBBLE_CLASS,
  MEME_IMG_CLASS,
  injectMemeBubbleCss,
  memeImageUrl,
  whisperBubbleView,
  type WhisperBubbleRow,
} from '../shared/whisper';
import type { ReactNode } from 'react';
import type { jsx } from 'react/jsx-runtime';

/** 气泡内联样式：白色半透明圆泡加底部小尾巴，盒子尺寸锚字号 `--f`，位置锚宠物尺寸。
 *  width:max-content 不可省：left:50% 的绝对定位盒可用宽度只有包含块一半，shrink-to-fit
 *  会先被卡死；先按内容取宽，再由 max-width 收口。box-sizing 钉死 content-box，避免宿主
 *  全局 border-box 把内边距算进宽度；断词用 break-word，数字与单位不会被拆行。
 */
const bubbleCss = [
  // 本地字体：由 host 从 assets/fonts 提供；font-display:swap 先回退后切换。
  '@font-face{font-family:"ShangshouSoftCandy";src:url("/dsh-pet-7340/font/上首软糖体.ttf") format("truetype");font-display:swap;font-weight:400}',
  '.dsh-pet-bubble{position:absolute;left:50%;transform:translateX(-50%);' +
    'bottom:calc(100% - var(--dsh-pet-size)*0.108);' +
    'width:max-content;min-width:calc(var(--f)*5.7143);max-width:min(calc(var(--f)*16),100%);' +
    // 钉死 content-box：宿主可能全局设了 border-box，让 min/max-width 把内边距算进去，
    // 表现为「明明还有空位却折行」；桌面端同样钉死，两端一致。
    'box-sizing:content-box;' +
    'padding:calc(var(--f)*0.4835) calc(var(--f)*0.6593);' +
    'border-radius:calc(var(--f)*0.7692);' +
    'background:rgba(255,255,255,.92);' +
    '--f0:var(--dsh-pet-font-bubble,calc(var(--dsh-pet-size)*0.0455));--f:var(--f0);' +
    'color:#2b2b2b;font-family:var(--dsh-pet-font-family,"ShangshouSoftCandy","Yuanti SC","YouYuan","幼圆","Comic Sans MS","PingFang SC","Microsoft YaHei",sans-serif);' +
    'font-size:var(--f);line-height:1.6;z-index:3;pointer-events:none;' +
    'box-shadow:0 calc(var(--f)*0.1978) calc(var(--f)*0.7692) rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.08);' +
    'backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease;' +
    'white-space:normal;overflow-wrap:break-word}',
  // 底部尾巴：小三角指向下方宠物，尺寸锚字号。
  '.dsh-pet-bubble::after{content:"";position:absolute;left:50%;bottom:calc(var(--f)*-0.3736);' +
    'transform:translateX(-50%);border:calc(var(--f)*0.3736) solid transparent;' +
    'border-top-color:rgba(255,255,255,.92);border-bottom:none}',
  '.dsh-pet-bubble.is-on{opacity:1}',
  // 碎碎念变体：字号缩到余额气泡的 0.75，宽度下限更窄，上限与折行规则相同。
  '.dsh-pet-bubble.dsh-pet-whisper{font-size:calc(var(--f)*0.7473);' +
    'min-width:calc(var(--f)*2.1978);max-width:min(calc(var(--f)*10.989),100%)}',
  // 配图样式在 shared 的 MEME_BUBBLE_CSS，这里只保留标题与行样式。
  '.dsh-pet-bubble .pet-bub-title{font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6);margin-bottom:calc(var(--f)*0.1978)}',
  '.dsh-pet-bubble .pet-bub-row{display:flex;justify-content:space-between;gap:calc(var(--f)*0.6593);flex-wrap:wrap}',
  // 档位行由多个片段拼成：只在片段之间换行，片段内部不拆字，避免竖排。
  '.dsh-pet-bubble .pet-bub-row>span{white-space:nowrap}',
  '.dsh-pet-bubble .pet-bub-sub{font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6)}',
  '.dsh-pet-bubble .pet-bub-val{font-variant-numeric:tabular-nums;font-weight:650;color:#1f1f1f}',
  '.dsh-pet-bubble .pet-bub-err{color:#d94f3d;font-size:calc(var(--f)*0.7692)}',
  '.dsh-pet-bubble .pet-bub-tag{margin-left:calc(var(--f)*0.2857);font-size:calc(var(--f)*0.4835);color:rgba(43,43,43,.55);border:1px solid rgba(43,43,43,.25);' +
    'border-radius:calc(var(--f)*0.2857);padding:0 calc(var(--f)*0.1978);vertical-align:1px}',
  // 峰/谷计价档位：峰红、谷绿。
  '.dsh-pet-bubble .pet-bub-tier{font-weight:700}',
  '.dsh-pet-bubble .pet-bub-tier-peak{color:#e53935}',
  '.dsh-pet-bubble .pet-bub-tier-idle{color:#2e9e4f}',
  // 展开态：每个窗口一行，进度条长度等于已用百分比。
  // 气泡默认不挡宿主页面，只有可展开的余额气泡才开命中。
  '.dsh-pet-bubble.is-clickable{pointer-events:auto;cursor:pointer}',
  // 收起态排不下「窗口名 + 条 + 百分比 + 重置」四列，展开态单独加宽并缩到 60% 字号。
  '.dsh-pet-bubble.is-expanded{--f:calc(var(--f0)*0.6);width:min(calc(var(--f)*21),100%);max-width:100%}',
  // 淡出：换内容前先透明，换完去掉这个类再淡入。
  '.dsh-pet-bubble.is-on.is-fading{opacity:0}',
  '.dsh-pet-bubble .pet-bub-quota{display:flex;align-items:center;gap:calc(var(--f)*0.4);margin:calc(var(--f)*0.13) 0}',
  '.dsh-pet-bubble .pet-bub-quota-label{flex:none;min-width:calc(var(--f)*1.9);font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6)}',
  '.dsh-pet-bubble .pet-bub-quota-bar{flex:1 1 auto;height:calc(var(--f)*0.5);border-radius:calc(var(--f)*0.25);background:rgba(43,43,43,.12);overflow:hidden}',
  '.dsh-pet-bubble .pet-bub-quota-fill{display:block;height:100%;border-radius:inherit;background:#2e9e4f}',
  '.dsh-pet-bubble .pet-bub-quota-fill.pet-bub-quota-warn{background:#e8952f}',
  '.dsh-pet-bubble .pet-bub-quota-fill.pet-bub-quota-crit{background:#e53935}',
  '.dsh-pet-bubble .pet-bub-quota-used{flex:none;min-width:calc(var(--f)*2.2);text-align:right;font-variant-numeric:tabular-nums;font-weight:650;color:#1f1f1f}',
  '.dsh-pet-bubble .pet-bub-quota-reset{flex:none;min-width:calc(var(--f)*2.6);text-align:right;font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6)}',
].join('\n');

/** 注入气泡样式，每页只注入一次。 */
function injectBubbleCss(): void {
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-pet/bubble"]') === null) {
    const tag = document.createElement('style');
    tag.dataset.plugin = 'dsh-pet';
    tag.dataset.pluginCss = 'dsh-pet/bubble';
    tag.textContent = bubbleCss;
    document.head.appendChild(tag);
  }
}

/** 把气泡行数据映射成 React 节点（碎碎念只有单行 label 形态）。 */
function rowsToNodes(h: typeof jsx, rows: WhisperBubbleRow[]): ReactNode {
  return rows.map((r, i) => h('div', { key: i, className: 'pet-bub-row', children: r.text }));
}

/** 制造碎碎念气泡组件（工厂），复用同一套气泡样式与行渲染。
 *  image 是池内名（按素材根拼路径），url 是第三方完整地址，两者互斥且由 host 判定层保证。
 *  有配图时渲染在文字上方，图片样式取自 shared 的 MEME_BUBBLE_CSS。
 */
export function makeWhisperBubble(rt: {
  h: typeof jsx;
}): (props: { text: string; image?: string; url?: string; assetRoot?: string; on: boolean }) => ReactNode {
  const { h } = rt;
  injectBubbleCss();
  injectMemeBubbleCss();

  return function WhisperBubble({
    text,
    image,
    url,
    assetRoot,
    on,
  }: {
    text: string;
    image?: string;
    url?: string;
    assetRoot?: string;
    on: boolean;
  }) {
    const rows = whisperBubbleView({ ok: true, text, ts: 0 });
    const key = String(image ?? '').trim();
    const href = String(url ?? '').trim();
    // 配图二选一：url 直接用，image 按素材根拼路径；判别位在字段名上，不靠 startsWith 嗅探。
    const src = href || (key ? memeImageUrl(key, '/dsh-pet-7340', assetRoot) : '');
    return h('div', {
      className: 'dsh-pet-bubble dsh-pet-whisper' + (src ? ' ' + MEME_BUBBLE_CLASS : '') + (on ? ' is-on' : ''),
      children: src
        ? [
            h('img', {
              key: 'img',
              className: MEME_IMG_CLASS,
              // 名称形态拼本页路由前缀；url 形态是完整地址，与本页 origin 无关。
              src,
              alt: key || href,
            }),
            rowsToNodes(h, rows),
          ]
        : rowsToNodes(h, rows),
    });
  };
}
