// tsdown 配置（仿官方 DSH 客户端插件的构建方式：src → lib 产物）
// 说明：DSH 浏览器插件生产出的 lib/client.js 必须是
//       window.__ModuleLoader__.load({ id, factory }) 单文件形态；
//       react / react/jsx-runtime / @deepseek-ai/* 保持外部 require（不打包）。
//
// 两份配置：
//   1) 浏览器半侧（client → lib/client.js）—— 与 DSH 内运行一致，@deepseek-ai/* 全部
//      外部化（那些包由 DSH 宿主提供）；产物额外包一层 IIFE，理由见该份配置里的注释。
//   2) 宿主半侧（index → lib/index.js）—— 保持 ESM，由 DSH 的 Loader import。
//
// 独立模式（lib/standalone.js）与应用打包（lib/app.js）已移除：本包只作为 DSH 插件运行。
import { defineConfig } from 'tsdown';

/** 两份配置共用的编译口径 */
const shared = {
  format: ['esm'],
  platform: 'node',
  target: 'es2020',
  dts: false,
  outDir: 'lib',
  clean: false,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      client: 'src/client/index.ts',
    },
    external: [/^@deepseek-ai\//, /^@electron\//, /^node:/],
    // 浏览器半侧必须能被**重复执行**：DSH 把 lib/client.js 当经典脚本加载，而 bundle
    // 重建后（HMR 换 rev）或 combo 请求重试时，同一个文件会在同一个页面里再执行一次。
    // 经典脚本的顶层 const/let/function 落在页面的全局词法作用域，第二次解析直接
    // SyntaxError（Identifier 'PET_DISPLAYS' has already been declared），entry 激活
    // 失败 → 桌宠 overlay 与设置页插槽都不注册，只能刷新才恢复。因此整份产物包一层
    // IIFE，让所有模块体声明留在函数作用域内；前导 ';' 抵消 combo 拼接（多个插件
    // bundle 连成一个脚本）时的 ASI 歧义。
    outputOptions: { banner: ';(()=>{', footer: '})();' },
  },
  {
    ...shared,
    // 宿主半侧保持 ESM（由 DSH 的 Loader import），绝不能包 IIFE。
    entry: {
      index: 'src/host/index.ts',
    },
    // 宿主侧把 dsh-home-paths / dsh-llm 及其闭包一起打进产物：DSH 不同版本的 profile
    // 不保证能解析这些 @deepseek-ai 对等依赖（pnpm 操作会把投影删掉），而它们只是纯函数，
    // 打包后插件在任何 profile 里都能独立加载。
    external: [/^@electron\//, /^node:/],
    // 覆盖 tsdown 对 peerDependencies 的默认外部化：这两个包要进产物。
    noExternal: [/^@deepseek-ai\//],
  },
]);
