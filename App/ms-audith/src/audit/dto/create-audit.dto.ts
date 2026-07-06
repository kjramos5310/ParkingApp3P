import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
  IsOptional,
  IsDate,
  IsInt,
  IsIP,
  IsMACAddress,
} from 'class-validator';

export class CreateAuditDto {
    @IsString()
    @IsNotEmpty()
    accion!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(7)
    @MaxLength(50)
    @Matches(/^(ms-[a-zA-Z\-]+)$/, {
        message: 'servicio invalido. debe empezar con ms- seguido de letras minusculas o guiones'
    })
    servicio!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(4)
    @MaxLength(15)
    @Matches(/^[a-z_]+$/, {
        message: 'entidad invalida. debe usar solo letras minusculas y guiones bajos'
    })
    entidad!: string; //crud CREATE UPDATE DELETE 

    @IsObject()
    @IsOptional()
    datos!: Record<string, any>;

    @IsDate()
    @IsNotEmpty()
    fecha_hora: Date;

    @IsInt()
    @IsOptional()
    id_usuario: number;

    @IsString()
    @IsOptional()
    @MinLength(3)
    @MaxLength(100)
    @Matches(/^[a-zA-Z0-9._\-@ ]+$/, {
        message: 'usuario invalido. debe usar un formato de usuario o correo valido'
    })
    usuario!: string;

    @IsIP('4', { message: 'ip invalida. debe ser una ip valida' })
    ip!: string;

    @IsMACAddress({ message: 'mac invalida. debe ser una mac valida' })
    mac!: string;

    @IsString()
    @IsOptional()
    id_vehiculo?: string;
}
