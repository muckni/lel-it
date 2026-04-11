import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@owit/3d", "@react-three/fiber", "@react-three/drei", "three"],
};

export default nextConfig;
