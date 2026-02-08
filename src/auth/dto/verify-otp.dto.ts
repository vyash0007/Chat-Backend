import { IsNotEmpty, IsString, Length, Matches, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { IsValidPhoneNumberConstraint } from './send-otp.dto';

export class VerifyOtpDto {
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

  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  otp: string;
}
