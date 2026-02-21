{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ?
    import sources.nixpkgs {
      inherit system;
      config = {};
      overlays = [];
    },
}: let
  version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
  dependencyHash = "sha256-4gYgzYJNCOPaAfvPwBpq/Y6y8SLUzo3HS44MWom8hyE=";
  buildOnVersion = nodeVersion:
    pkgs.buildNpmPackage {
      pname = "tartan-core";
      version = version;
      src = pkgs.nix-gitignore.gitignoreSource [] ./.;
      npmDepsHash = dependencyHash;
      nodejs = pkgs."nodejs_${nodeVersion}";
      doCheck = true;
      checkPhase = "node --version; npm test";
    };
in {
  checks = let
    nodeVersions = ["20" "22" "24"]; # maintained LTS versions
  in
    builtins.listToAttrs (map (version: {
        name = "node-v${version}";
        value = buildOnVersion version;
      })
      nodeVersions);

  shell = pkgs.mkShell {
    packages = with pkgs; [
      nodejs_24
      npins
      (pkgs.writeShellScriptBin "update-deps-hash" ''
        HASH=$(${pkgs.prefetch-npm-deps}/bin/prefetch-npm-deps package-lock.json)
        echo $HASH
        ${pkgs.gnused}/bin/sed -e "s|dependencyHash = \".*\"|dependencyHash = \"$HASH\"|" --in-place=.backup default.nix;
      '')
    ];
  };

  package = buildOnVersion "24"; # latest LTS node version
}
