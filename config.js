var secretKeyBase = {
  development: "20db9fee04d5d57f69e116638dadc5bfc3043a61b5935d6e80dc62410753da4d101c7d3f45f1d69eae44a15f86eaa8ffa1971d374df71e86ae724a007cd10063",
  production: process.env.SECRET_KEY_BASE
};

exports.secretKeyBase = secretKeyBase;
