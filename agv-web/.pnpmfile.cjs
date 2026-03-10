function readPackage(pkg) {
  // fast-xml-parser@5.5.0 ships a broken "file:../fxp-builder" local dep
  if (pkg.dependencies && pkg.dependencies['fast-xml-parser']) {
    pkg.dependencies['fast-xml-parser'] = '4.4.1';
  }
  if (pkg.optionalDependencies && pkg.optionalDependencies['fast-xml-parser']) {
    pkg.optionalDependencies['fast-xml-parser'] = '4.4.1';
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
