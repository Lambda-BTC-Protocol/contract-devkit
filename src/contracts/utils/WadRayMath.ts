import { ExecutionError } from "@/contracts/types/execution-error";
import { uint256, type, Uint } from "solidity-math";


export class WadRayMath {
  private WAD: Uint = new Uint(1e18, 256);
  private halfWAD: Uint = this.WAD.div(2);

  private RAY: Uint = new Uint(1e27, 256);
  private halfRAY: Uint = this.RAY.div(2);

  private WAD_RAY_RATIO: Uint = new Uint(1e9, 256);

  /**
   * @return One ray, 1e27
   **/
  ray(): Uint {
    return this.RAY;
  }

  /**
   * @return One wad, 1e18
   **/

  wad(): Uint {
    return this.WAD;
  }

  /**
   * @return Half ray, 1e27/2
   **/
  halfRay(): Uint {
    return this.halfRAY;
  }

  /**
   * @return Half ray, 1e18/2
   **/
  halfWad(): Uint {
    return this.halfWAD;
  }

  /**
   * @dev Multiplies two wad, rounding half up to the nearest wad
   * @param a Wad
   * @param b Wad
   * @return The result of a*b, in wad
   **/
  wadMul(a: Uint, b: Uint): Uint {
    if (a.eq(0) || b.eq(0)) {
      return new Uint(0, 256);
    }

    if (a > type(uint256).max.sub(this.halfWAD).div(b)) {
      throw new ExecutionError("MATH_MULTIPLICATION_OVERFLOW");
    }

    return a.mul(b).add(this.halfWAD).div(this.WAD);
  }

  /**
   * @dev Divides two wad, rounding half up to the nearest wad
   * @param a Wad
   * @param b Wad
   * @return The result of a/b, in wad
   **/
  wadDiv(a: Uint, b: Uint): Uint {
    if (b.eq(0)) {
      throw new ExecutionError("MATH_DIVISION_BY_ZERO");
    }
    const halfB = b.div(2);

    if (a > type(uint256).max.sub(halfB).div(this.WAD)) {
      throw new ExecutionError("MATH_MULTIPLICATION_OVERFLOW");
    }
    return a.mul(this.WAD).add(halfB).div(b);
  }

  /**
   * @dev Multiplies two ray, rounding half up to the nearest ray
   * @param a Ray
   * @param b Ray
   * @return The result of a*b, in ray
   **/
  rayMul(a: Uint, b: Uint): Uint {
    if (a.eq(0) || b.eq(0)) {
      return new Uint(0, 256);
    }
    if (a > type(uint256).max.sub(this.halfRAY).div(b)) {
      throw new ExecutionError("MATH_MULTIPLICATION_OVERFLOW");
    }

    return a.mul(b).add(this.halfRAY).div(this.RAY);
  }

  /**
   * @dev Divides two ray, rounding half up to the nearest ray
   * @param a Ray
   * @param b Ray
   * @return The result of a/b, in ray
   **/
  rayDiv(a: Uint, b: Uint): Uint {
    if (b.eq(0)) {
      throw new ExecutionError("MATH_DIVISION_BY_ZERO");
    }
    const halfB = b.div(2);

    if (a > type(uint256).max.sub(halfB).div(this.RAY)) {
      throw new ExecutionError("MATH_MULTIPLICATION_OVERFLOW");
    }
    return a.mul(this.RAY).add(halfB).div(b);
  }

  /**
   * @dev Casts ray down to wad
   * @param a Ray
   * @return a casted to wad, rounded half up to the nearest wad
   **/
  rayToWad(a: Uint): Uint {
    const halfRatio = this.WAD_RAY_RATIO.div(2);
    const result = a.add(halfRatio);
    if (result < halfRatio) {
      throw new ExecutionError("MATH_ADDITION_OVERFLOW");
    }
    return result.div(this.WAD_RAY_RATIO);
  }

  /**
   * @dev Converts wad up to ray
   * @param a Wad
   * @return a converted in ray
   **/
  wadToRay(a: Uint): Uint {
    const result = a.mul(this.WAD_RAY_RATIO);
    if (result.div(this.WAD_RAY_RATIO) != a) {
      throw new ExecutionError("MATH_MULTIPLICATION_OVERFLOW");
    }
    return result;
  }
}
