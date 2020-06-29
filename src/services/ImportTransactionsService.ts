import csvParse from 'csv-parse';
import fs from 'fs';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionRepository = getCustomRepository(TransactionRepository);

    // Criando a stream que vai ler os arquivos
    const contactReadStream = fs.createReadStream(filePath);

    // Criando uma instancia do csvParse (consigurando)
    const parsers = csvParse({
      from_line: 2, // Estabelecendo a 1a. linha do template
    });

    const parseCsv = contactReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    // A cada linha do dado -> desestruturar (lendo linha por linha do arquivo)
    parseCsv.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      // Verificar se as variáveis estão chegando corretamente:
      if (!title || !type || !value) return;

      // Ppreparando os dados para serem inseridos no BD
      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    // Verificando de o parseCsv emitiu um evento chamado end
    // Quando o evento end for emitido -> serão retornados os valores de categories e transactions
    await new Promise(resolve => parseCsv.on('end', resolve));

    // Verificando se as categorias do arquivo file exstem no BD de uma vez só com o método In
    // Busca pelo titulo das categorias no array de categories
    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // Retorna o titulo da categoria que já existe no BD
    const existentCategoryTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // Retorna todas as categorias menos as que já existem no BD (filtro)
    // Filtra categorias duplicadas - busca index onde o value seja igual e retira da lista -> filter((value, index, self)
    const addCategoryTitles = categories
      .filter(category => !existentCategoryTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // Criando instancia das categorias filtradas
    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title })),
    );

    // Salvando categorias no BD
    await categoriesRepository.save(newCategories);

    // Todas as categorias
    const finalCategories = [...newCategories, ...existentCategories];

    // Criando Transações:
    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    // Salvando Transação no BD
    await transactionRepository.save(createdTransactions);

    // Excluir o arquivo file depois dele rodar na aplicação:
    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
