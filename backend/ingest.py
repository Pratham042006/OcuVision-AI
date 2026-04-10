from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

# 1. Load all PDFs from your folder
loader = DirectoryLoader('./knowledge_base', glob="./*.pdf", loader_cls=PyPDFLoader)
docs = loader.load()

# 2. Split into chunks (size 500-1000 is standard for medical data)
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
chunks = text_splitter.split_documents(docs)

# 3. Create Vector Store with Local Embeddings
print("Creating vector store with local embeddings... (this might take a moment)")
vectorstore = Chroma.from_documents(
    documents=chunks, 
    embedding=HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2"), 
    persist_directory="./chroma_db"
)

print("Knowledge base ready!")