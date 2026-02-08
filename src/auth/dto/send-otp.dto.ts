import { IsNotEmpty, IsString, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { Transform } from 'class-transformer';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Custom validator to check if phone number is valid using libphonenumber-js
 */
@ValidatorConstraint({ name: 'IsValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phone: string, args: ValidationArguments) {
    if (!phone) return false;

    try {
      // Check if phone number is valid
      return isValidPhoneNumber(phone);
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'Phone number must be a valid international phone number (e.g., +14155552671)';
  }
}

export class SendOtpDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @Validate(IsValidPhoneNumberConstraint)
  @Transform(({ value }) => {
    // Normalize phone number to E.164 format
    if (!value) return value;

    try {
      const phoneNumber = parsePhoneNumber(value);
      if (phoneNumber) {
        return phoneNumber.format('E.164'); // Returns format like +14155552671
      }
      return value;
    } catch (error) {
      // If parsing fails, return original value (will fail validation)
      return value;
    }
  })
  phone: string;
}
