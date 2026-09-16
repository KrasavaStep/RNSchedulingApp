module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Этот плагин должен идти строго первым для WatermelonDB (чтобы обрабатывать декораторы TS)
      ["@babel/plugin-proposal-decorators", { legacy: true }],
    ],
  };
};
