export class WadRayMath {
    static WAD = BigInt(1e18);
    static RAY = BigInt(1e27);
    static WAD_RAY_RATIO = BigInt(1e9);

    /**
     * @return One ray, 1e27
     **/
    static ray(): bigint {
        return this.RAY;
    }

    /**
     * @return One wad, 1e18
     **/
    static wad(): bigint {
        return this.WAD;
    }

    /**
     * @dev Multiplies two ray values, rounding half up to the nearest ray
     * @param a Ray
     * @param b Ray
     * @return The result of a * b, in ray
     **/
    static rayMul(a: bigint, b: bigint): bigint {
        if (a === BigInt(0) || b === BigInt(0)) {
            return BigInt(0);
        }

        return (a * b + this.RAY / BigInt(2)) / this.RAY;
    }

    /**
     * @dev Divides two ray values, rounding half up to the nearest ray
     * @param a Ray
     * @param b Ray
     * @return The result of a / b, in ray
     **/
    static rayDiv(a: bigint, b: bigint): bigint {
        if (b === BigInt(0)) {
            throw new Error("MATH_DIVISION_BY_ZERO");
        }

        return (a * this.RAY + b / BigInt(2)) / b;
    }

    /**
     * @dev Converts wad to ray
     * @param a Wad
     * @return Converted value in ray
     **/
    static wadToRay(a: bigint): bigint {
        return a * this.WAD_RAY_RATIO;
    }

    /**
     * @dev Converts ray to wad
     * @param a Ray
     * @return Converted value in wad
     **/
    static rayToWad(a: bigint): bigint {
        return a / this.WAD_RAY_RATIO;
    }
}

