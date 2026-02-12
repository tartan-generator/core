{
  description = "Core functions for Tartan";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: let
    pkgs = nixpkgs.legacyPackages.x86_64-linux;
    version = "0.7.1";
    dependencyHash = "sha256-Tc5quacGssuvcx+FhdUn8/IzakqZc2BqHySueBPbS2w=";
  in {
    checks.x86_64-linux = let
      nodeVersions = ["20" "22" "24"];
    in
      builtins.listToAttrs (map (version: {
          name = "node-v${version}";
          value = pkgs.buildNpmPackage {
            pname = "tartan-test-nodejs-${version}";
            version = version;
            src = ./.;
            npmDepsHash = dependencyHash;
            nodejs = pkgs."nodejs_${version}";

            dontBuild = true;

            doCheck = true;
            checkPhase = "node --version; npm test";

            installPhase = "touch $out";
          };
        })
        nodeVersions);

    devShells.x86_64-linux.default = self.packages.x86_64-linux.default;

    packages.x86_64-linux.default = pkgs.buildNpmPackage {
      pname = "tartan-core";
      version = version;
      src = ./.;
      npmDepsHash = dependencyHash;
      nodejs = pkgs.nodejs_24;
      doCheck = true;
      checkPhase = "node --version; npm test";
      installPhase = "cp -r . $out";
    };
  };
}
