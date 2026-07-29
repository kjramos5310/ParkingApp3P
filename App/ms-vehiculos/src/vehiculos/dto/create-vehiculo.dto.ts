import { IsNotEmpty, IsNumber, IsString, IsPositive, Matches, Min, Max, MinLength, MaxLength, IsInt, IsEnum, IsIn, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { TipoMotocicleta } from "../entities/motocicleta.entity";

class BaseVehiculoDto {

    @IsString()
    @Matches(/^[a-zA-Z\s]+$/, {
        message: 'Formato de marca invalido. Debe contener solo letras o espacios'
    })
    @IsNotEmpty()
    @MinLength(3, { message: 'La marca debe tener mas de 3 caracteres' })
    @MaxLength(15, { message: 'La marca debe tener menos de 15 caracteres' })
    marca!: string;

    @IsString()
    @Matches(/^[A-Z]{3}-\d{4}$/, {
        message: 'Formato de placa invalido. Debe ser XXX-0000'
    })
    @IsNotEmpty()
    @MinLength(7, { message: 'La placa debe tener 7 caracteres' })
    @MaxLength(7, { message: 'La placa debe tener 7 caracteres' })
    placa!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(4, { message: 'El modelo debe tener mas de 3 caracteres' })
    @MaxLength(15, { message: 'El modelo debe tener menos de 15 caracteres' })
    modelo!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z\s]+$/, {
        message: 'Formato de color invalido. Debe contener solo letras o espacios'
    })
    @MinLength(4, { message: 'El color debe tener mas de 3 caracteres' })
    @MaxLength(15, { message: 'El color debe tener menos de 15 caracteres' })
    color!: string;

    @IsNumber()
    @IsPositive()
    @Min(1900, {
        message: 'El anio debe ser mayor a 1900'
    })
    @IsInt({
        message: 'El anio debe ser un numero entero'
    })
    anio!: number;
}

class AutoDTO extends BaseVehiculoDto {
    @IsNumber()
    @IsInt({
        message: 'El anio debe ser un numero entero'
    })
    @IsPositive()
    @Min(2, { message: 'El numero de puertas debe ser mayor a 1' })
    @Max(5, { message: 'El numero de puertas debe ser menor a 10' })
    numeroPuertas!: number;

    @IsNumber()
    @IsInt({
        message: 'El anio debe ser un numero entero'
    })
    @IsPositive()
    @Min(1, { message: 'El numero de puertas debe ser mayor a 1' })
    @Max(10, { message: 'El numero de puertas debe ser menor a 10' })
    capacidadMaletero!: number;
}

class CamionetaDTO extends BaseVehiculoDto {
    @IsNumber()
    @IsPositive()
    cilindraje!: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(10, { message: 'La cabina debe tener menos de 10 caracteres' })
    @MinLength(4, { message: 'La cabina debe tener mas de 3 caracteres' })
    @Matches(/^[A-Z][a-z]*$/, {
        message: 'Formato de cabina invalido. Debe contener solo letras o espacios'
    })
    cabina!: string;

    @IsNumber()
    @IsPositive()
    @Min(1, { message: 'El numero de puertas debe ser mayor a 1' })
    @Max(10, { message: 'El numero de puertas debe ser menor a 10' })
    capacidadCarga!: number;
}

class MotocicletaDTO extends BaseVehiculoDto {

    @Matches(/^[A-Z]{2}-\d{3}[A-Z]{1}$/, {
        message: 'Formato de placa invalido. Debe ser XXX-0000'
    })
    placa!: string;

    @IsNumber()
    @IsPositive()
    cilindraje!: number;

    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    tipoManubrio!: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(TipoMotocicleta, {
        message: 'Formato de tipo invalido. Debe ser SCOOTER, DEPORTIVA, TURISMO, CHOw, CUATRIMOTO, ENDURO'
    })
    tipo!: string;
}

export class CreateVehiculoDto {
    @IsIn(['Auto', 'Motocicleta', 'Camioneta'])
    tipo!: string;

    @ValidateNested()
    @Type((opts) => {
        const object = opts?.object as CreateVehiculoDto;
        if (!object) return BaseVehiculoDto;

        switch (object.tipo) {
            case 'Auto': return AutoDTO;
            case 'Motocicleta': return MotocicletaDTO;
            case 'Camioneta': return CamionetaDTO;
            default: return BaseVehiculoDto;
        }
    })
    datos!: AutoDTO | MotocicletaDTO | CamionetaDTO;
}
