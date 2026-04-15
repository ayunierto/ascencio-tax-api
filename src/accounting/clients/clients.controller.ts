import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Role } from 'src/auth/enums/role.enum';
import {
  CreateClientRequest,
  UpdateClientRequest,
  createClientSchema,
  updateClientSchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ClientsService } from './clients.service';
import { User } from 'src/auth/entities/user.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { Client } from './entities/client.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ========================
  // POST /clients
  // ========================
  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createClientSchema))
    client: CreateClientRequest,
    @GetUser() user: User,
  ): Promise<Client> {
    return this.clientsService.create(user, client);
  }

  // ========================
  // GET /clients
  // ========================
  @Get()
  @Auth()
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('search') search: string | undefined,
    @GetUser() user: User,
  ): Promise<PaginatedResponse<Client>> {
    return this.clientsService.findAll(paginationDto, user.id, search);
  }

  // ========================
  // GET /clients/:id
  // ========================
  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User): Promise<Client> {
    return this.clientsService.findOne(user.id, id);
  }

  // ========================
  // PATCH /clients/:id
  // ========================
  @Patch(':id')
  @Auth(Role.Admin, Role.Staff, Role.User)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClientSchema))
    body: UpdateClientRequest,
    @GetUser() user: User,
  ): Promise<Client> {
    return this.clientsService.update(user.id, id, body);
  }

  // ========================
  // DELETE /clients/:id
  // ========================
  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @GetUser() user: User): Promise<Client> {
    return this.clientsService.remove(user.id, id);
  }
}
