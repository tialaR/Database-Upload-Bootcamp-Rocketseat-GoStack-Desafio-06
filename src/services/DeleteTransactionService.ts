import { getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';
import TransactionRepository from '../repositories/TransactionsRepository';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    const transactionRepository = getCustomRepository(TransactionRepository);

    // Buscar transaction p/ ver se existe no BD
    const transaction = await transactionRepository.findOne(id);

    // Caso não exista a transação no BD -> Retornar errro
    if (!transaction) {
      throw new AppError('Transaction does not exist.');
    }

    // Caso exista a transação no BD -> Deletar:
    await transactionRepository.remove(transaction);
  }
}

export default DeleteTransactionService;
