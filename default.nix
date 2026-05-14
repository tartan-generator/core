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
  dependencyHash = "sha256-eJxXBy4YA/TxCVJK1Tu2CZXek2WQxNpLimuQFEndQoU=";
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
      nodeVersions)
    // {
      consoleLogCheck = pkgs.stdenv.mkDerivation {
        pname = "tartan-core-console-log-check";
        version = version;
        src = builtins.fetchGit {
          url = ./.;
          shallow = true; # required to work in a github actions runner
        };
        buildInputs = [pkgs.ripgrep];
        doCheck = true;
        checkPhase = "! rg --line-number --type-add 'web:*.{js,ts}' --type web '^[^/]*console\\.log' ."; # basic search for uncommented console.log
        installPhase = "echo \":3\" > $out";
      };
    };

  shell = pkgs.mkShell {
    packages = with pkgs; [
      nodejs_24
      npins
      tsx
      # great script name ik
      (pkgs.writeShellScriptBin "update-npm-stuff" ''
        npm i # ensure that package-lock is up to date
        HASH=$(${pkgs.prefetch-npm-deps}/bin/prefetch-npm-deps package-lock.json)
        echo $HASH
        ${pkgs.gnused}/bin/sed -e "s|dependencyHash = \".*\"|dependencyHash = \"$HASH\"|" --in-place=.backup default.nix;
      '')
    ];
  };

  package = buildOnVersion "24"; # latest LTS node version
}
