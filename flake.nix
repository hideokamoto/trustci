{
  description = "trustci development shell";

  inputs.nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.xz";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        # No x86_64-darwin: nixpkgs 26.11 dropped it, and its bun excludes it from meta.platforms.
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        # Node 24, not 22: nixpkgs' nodejs_22 bundles npm 10, below MIN_NPM in src/npm.ts.
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_24
            pkgs.bun
          ];
        };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt);
    };
}
