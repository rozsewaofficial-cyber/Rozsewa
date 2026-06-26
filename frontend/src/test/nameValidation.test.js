import { describe, it, expect } from "vitest";
import { sanitizeName, sanitizeNameOnChange, validateName } from "../lib/nameValidation";

describe("nameValidation utility", () => {
  describe("sanitizeNameOnChange", () => {
    it("should trim leading spaces", () => {
      expect(sanitizeNameOnChange("  John")).toBe("John");
    });

    it("should collapse consecutive spaces", () => {
      expect(sanitizeNameOnChange("John   Doe")).toBe("John Doe");
    });

    it("should preserve special characters and numbers while typing", () => {
      expect(sanitizeNameOnChange("John123 @")).toBe("John123 @");
    });

    it("should allow typing trailing space", () => {
      expect(sanitizeNameOnChange("John ")).toBe("John ");
    });
  });

  describe("sanitizeName", () => {
    it("should trim leading and trailing spaces", () => {
      expect(sanitizeName("  John Doe  ")).toBe("John Doe");
    });

    it("should collapse consecutive spaces", () => {
      expect(sanitizeName("John    Doe")).toBe("John Doe");
    });

    it("should strip numbers and special characters", () => {
      expect(sanitizeName("John123 @Doe!")).toBe("John Doe");
    });

    it("should retain Unicode letters", () => {
      expect(sanitizeName("François Amit अमित")).toBe("François Amit अमित");
    });
  });

  describe("validateName", () => {
    it("should validate correct names", () => {
      const res = validateName("John Doe");
      expect(res.isValid).toBe(true);
      expect(res.message).toBe("");
    });

    it("should validate correct Unicode names", () => {
      const res = validateName("François Amit अमित");
      expect(res.isValid).toBe(true);
      expect(res.message).toBe("");
    });

    it("should reject empty names", () => {
      const res = validateName("");
      expect(res.isValid).toBe(false);
      expect(res.message).toBe("Full name is required.");
    });

    it("should reject names with only spaces", () => {
      const res = validateName("   ");
      expect(res.isValid).toBe(false);
      expect(res.message).toBe("Full name is required.");
    });

    it("should reject names containing numbers", () => {
      const res = validateName("John123");
      expect(res.isValid).toBe(false);
      expect(res.message).toBe("Full name must only contain letters and spaces.");
    });

    it("should reject names containing special characters", () => {
      const res = validateName("John @Doe");
      expect(res.isValid).toBe(false);
      expect(res.message).toBe("Full name must only contain letters and spaces.");
    });
  });
});
