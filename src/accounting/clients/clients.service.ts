import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonMessages } from '@ascencio/shared/i18n';
import { CreateClientRequest, UpdateClientRequest } from '@ascencio/shared';
import { Brackets, Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  // ========================
  // CREAR
  // ========================
  async create(user: User, input: CreateClientRequest): Promise<Client> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...clientData } = input;

    const client = this.clientRepo.create({
      ...clientData,
      users: [user],
    });

    return this.clientRepo.save(client);
  }

  // ========================
  // OBTENER TODOS (Paginado)
  // ========================
  async findAll(
    paginationDto: PaginationDto,
    userId: string,
    search?: string,
  ): Promise<PaginatedResponse<Client>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const normalizedSearch = search?.trim();

    const queryBuilder = this.clientRepo
      .createQueryBuilder('client')
      .innerJoin('client.users', 'user', 'user.id = :userId', { userId })
      .where('client.deletedAt IS NULL')
      .orderBy('client.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (normalizedSearch) {
      queryBuilder.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where('client.fullName ILIKE :search', {
              search: `%${normalizedSearch}%`,
            })
            .orWhere('client.email ILIKE :search', {
              search: `%${normalizedSearch}%`,
            })
            .orWhere('client.phone ILIKE :search', {
              search: `%${normalizedSearch}%`,
            })
            .orWhere('client.businessNumber ILIKE :search', {
              search: `%${normalizedSearch}%`,
            });
        }),
      );
    }

    const [clients, total] = await queryBuilder.getManyAndCount();

    return {
      total,
      pages: Math.ceil(total / limit),
      items: clients,
    };
  }

  // ========================
  // OBTENER UNO
  // ========================
  async findOne(userId: string, id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id, users: { id: userId } },
    });

    if (!client) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    return client;
  }

  // ========================
  // ACTUALIZAR
  // ========================
  async update(
    userId: string,
    id: string,
    input: UpdateClientRequest,
  ): Promise<Client> {
    const client = await this.findOne(userId, id);

    // Aplicar los cambios y guardar
    Object.assign(client, input);
    return this.clientRepo.save(client);
  }

  // ========================
  // ELIMINAR (Soft Delete)
  // ========================
  async remove(userId: string, id: string): Promise<Client> {
    const client = await this.findOne(userId, id);
    await this.clientRepo.softRemove(client);
    return client;
  }
}
